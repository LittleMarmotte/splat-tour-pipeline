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
# dromni/nerfstudio installs nerfstudio via `pip install --user` for the
# 'user' account, so packages live in /home/user/.local/lib/pythonX.Y/site-packages/.
# Exec-form CMD does NOT source .bashrc so we add the path manually.
_user_site = glob.glob('/home/user/.local/lib/python*/site-packages')
_extra_path = ':'.join(_user_site)
if _extra_path:
    os.environ['PYTHONPATH'] = _extra_path + ':' + os.environ.get('PYTHONPATH', '')
    print(f"[init] PYTHONPATH set to: {os.environ['PYTHONPATH']}", flush=True)

# Also ensure user local bin (ns-process-data etc.) is on PATH
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


def run_cmd(cmd, cwd=None):
    result = subprocess.run(cmd, shell=True, cwd=cwd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"Command failed: {cmd}\n{result.stderr}")
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
        print(f"[1/7] Downloading video from R2: {video_r2_path}")
        video_path = work_dir / "video.mp4"
        s3 = get_s3()
        s3.download_file(R2_BUCKET, video_r2_path, str(video_path))

        # 2. Extract frames with ffmpeg @ 2fps
        print("[2/7] Extracting frames at 2fps")
        frames_dir = work_dir / "frames"
        frames_dir.mkdir(exist_ok=True)
        run_cmd(f"ffmpeg -i {video_path} -vf fps=2 {frames_dir}/%05d.jpg -y")

        # 3. ns-process-data video → COLMAP
        print("[3/7] Running ns-process-data")
        data_dir = work_dir / "data"
        run_cmd(f"ns-process-data video --data {video_path} --output-dir {data_dir}")

        # 4. ns-train splatfacto 15k iterations
        print("[4/7] Training splatfacto (15k iters)")
        output_dir = work_dir / "output"
        run_cmd(
            f"ns-train splatfacto "
            f"--data {data_dir} "
            f"--output-dir {output_dir} "
            f"--max-num-iterations 15000 "
            f"nerfstudio-data"
        )

        # Find the checkpoint dir
        checkpoints = list(output_dir.rglob("config.yml"))
        if not checkpoints:
            raise RuntimeError("No training output found")
        config_path = checkpoints[0]

        # 5. ns-export gaussian-splat → .ply
        print("[5/7] Exporting Gaussian Splat")
        export_dir = work_dir / "export"
        run_cmd(
            f"ns-export gaussian-splat "
            f"--load-config {config_path} "
            f"--output-dir {export_dir}"
        )
        ply_path = list(export_dir.glob("*.ply"))[0]

        # 6. splat-transform: .ply → .sog + collision .glb
        print("[6/7] Converting to SOG + GLB")
        sog_path = work_dir / "scene.sog"
        glb_path = work_dir / "collision.glb"
        run_cmd(f"splat-transform {ply_path} {sog_path} --export-collision {glb_path}")

        # 7. Upload outputs to R2
        print("[7/7] Uploading artifacts to R2")
        s3.upload_file(str(sog_path), R2_BUCKET, f"outputs/{slug}/scene.sog")
        s3.upload_file(str(glb_path), R2_BUCKET, f"outputs/{slug}/collision.glb")

        # Callback n8n webhook #3
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
        print(f"ERROR: {error_msg}")
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
