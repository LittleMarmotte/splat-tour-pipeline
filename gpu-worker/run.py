"""
RunPod Serverless handler — Gaussian Splat pipeline
Input: { slug, video_r2_path, callback_url, airtable_record_id }
"""
import os
import glob
import subprocess
import shutil
import sys
import runpod
import boto3
import requests
from pathlib import Path

# Ensure nerfstudio packages are on PYTHONPATH for all subprocesses.
_user_site = glob.glob('/home/user/.local/lib/python*/site-packages')
_extra_path = ':'.join(_user_site)
if _extra_path:
    os.environ['PYTHONPATH'] = _extra_path + ':' + os.environ.get('PYTHONPATH', '')
    print(f"[init] PYTHONPATH: {os.environ['PYTHONPATH']}", flush=True)

os.environ['PATH'] = '/home/user/.local/bin:' + os.environ.get('PATH', '')

R2_ENDPOINT = os.environ["R2_ENDPOINT"]
R2_ACCESS_KEY = os.environ["R2_ACCESS_KEY_ID"]
R2_SECRET_KEY = os.environ["R2_SECRET_ACCESS_KEY"]
R2_BUCKET = os.environ.get("R2_BUCKET", "splat-tours")


def get_s3():
    return boto3.client(
        "s3",
        endpoint_url=R2_ENDPOINT,
        aws_access_key_id=R2_ACCESS_KEY,
        aws_secret_access_key=R2_SECRET_KEY,
    )


def run_cmd(cmd, cwd=None, stream=False, timeout=None):
    """Run a shell command. Use stream=True for long-running commands to avoid
    pipe buffer deadlock (output goes to stdout, not captured)."""
    print(f"  $ {cmd[:120]}", flush=True)
    if stream:
        # Don't capture — let output flow freely to avoid pipe deadlock
        result = subprocess.run(
            cmd, shell=True, cwd=cwd,
            stdout=None, stderr=None,   # inherit from parent → no buffer
            timeout=timeout,
        )
        if result.returncode != 0:
            raise RuntimeError(f"Command failed (exit {result.returncode}): {cmd}")
    else:
        result = subprocess.run(
            cmd, shell=True, cwd=cwd,
            capture_output=True, text=True,
            timeout=timeout,
        )
        if result.returncode != 0:
            raise RuntimeError(f"Command failed: {cmd}\n{result.stderr[-2000:]}")
        return result.stdout


def handler(job):
    job_input = job["input"]
    slug = job_input["slug"]
    video_r2_path = job_input["video_r2_path"]
    callback_url = job_input["callback_url"]
    record_id = job_input.get("airtable_record_id", "")

    work_dir = Path(f"/tmp/{slug}")
    work_dir.mkdir(parents=True, exist_ok=True)

    try:
        # 1. Download video from R2
        print(f"[1/7] Downloading video from R2: {video_r2_path}", flush=True)
        video_path = work_dir / "video.mp4"
        s3 = get_s3()
        s3.download_file(R2_BUCKET, video_r2_path, str(video_path))
        print(f"  Video size: {video_path.stat().st_size / 1e6:.1f} MB", flush=True)

        # 2. ns-process-data video → COLMAP (cap at 150 frames to keep COLMAP fast)
        print("[2/6] Running ns-process-data (COLMAP, max 150 frames)", flush=True)
        data_dir = work_dir / "data"
        run_cmd(
            f"ns-process-data video --data {video_path} --output-dir {data_dir} "
            f"--num-frames-target 150",
            stream=True, timeout=1800,
        )

        # 3. ns-train splatfacto — stream output to avoid pipe deadlock
        print("[3/6] Training splatfacto (7k iters)", flush=True)
        output_dir = work_dir / "output"
        run_cmd(
            f"ns-train splatfacto "
            f"--data {data_dir} "
            f"--output-dir {output_dir} "
            f"--max-num-iterations 7000 "
            f"--viewer.quit-on-train-completion True "
            f"nerfstudio-data",
            stream=True, timeout=3600,
        )

        # Find the config file
        checkpoints = list(output_dir.rglob("config.yml"))
        if not checkpoints:
            raise RuntimeError("No training output found — training may have failed silently")
        config_path = checkpoints[0]
        print(f"  Config: {config_path}", flush=True)

        # 4. ns-export gaussian-splat → .ply
        print("[4/6] Exporting Gaussian Splat (.ply)", flush=True)
        export_dir = work_dir / "export"
        run_cmd(
            f"ns-export gaussian-splat "
            f"--load-config {config_path} "
            f"--output-dir {export_dir}",
            stream=True, timeout=300,
        )
        ply_files = list(export_dir.glob("*.ply"))
        if not ply_files:
            raise RuntimeError("No .ply file exported")
        ply_path = ply_files[0]
        print(f"  PLY: {ply_path} ({ply_path.stat().st_size / 1e6:.1f} MB)", flush=True)

        # 5. splat-transform: .ply → .sog + collision .glb
        print("[5/6] Converting to SOG + GLB", flush=True)
        sog_path = work_dir / "scene.sog"
        glb_path = work_dir / "collision.glb"
        run_cmd(
            f"splat-transform {ply_path} {sog_path} --export-collision {glb_path}",
            timeout=300,
        )

        # 6. Upload outputs to R2
        print("[6/6] Uploading artifacts to R2", flush=True)
        s3.upload_file(str(sog_path), R2_BUCKET, f"outputs/{slug}/scene.sog")
        s3.upload_file(str(glb_path), R2_BUCKET, f"outputs/{slug}/collision.glb")
        print("  Upload complete", flush=True)

        # Callback n8n WF03
        requests.post(callback_url, json={
            "slug": slug,
            "record_id": record_id,
            "status": "done",
            "r2_splat_path": f"outputs/{slug}/scene.sog",
            "r2_collision_path": f"outputs/{slug}/collision.glb",
        }, timeout=30)

        return {"ok": True, "slug": slug}

    except Exception as e:
        error_msg = str(e)
        print(f"ERROR: {error_msg}", flush=True)
        try:
            requests.post(callback_url, json={
                "slug": slug,
                "record_id": record_id,
                "status": "failed_gpu",
                "error": error_msg,
            }, timeout=30)
        except Exception:
            pass
        return {"ok": False, "error": error_msg}
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)


runpod.serverless.start({"handler": handler})
