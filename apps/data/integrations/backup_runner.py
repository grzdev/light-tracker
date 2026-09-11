"""
Light Tracker Automated Backup Runner
Command-line utility for cron jobs, local disaster recovery backups, and cloud syncing.
"""

import argparse
import hashlib
import json
import os
import sys
import urllib.request
from datetime import datetime
from pathlib import Path


def calculate_sha256(canonical_str: str) -> str:
    return hashlib.sha256(canonical_str.encode("utf-8")).hexdigest()


def fetch_latest_backup(endpoint_url: str) -> dict:
    req = urllib.request.Request(
        endpoint_url,
        headers={"User-Agent": "LightTracker-BackupRunner/1.0", "Accept": "application/json"}
    )
    with urllib.request.urlopen(req) as response:
        return json.loads(response.read().decode("utf-8"))


def verify_snapshot_integrity(snapshot: dict) -> bool:
    claimed_checksum = snapshot.get("checksumSha256")
    if not claimed_checksum:
        print("[WARN] Snapshot does not contain a checksumSha256 property.")
        return False

    # Make copy without checksum
    copy_data = {k: v for k, v in snapshot.items() if k != "checksumSha256"}
    canonical_str = json.dumps(copy_data, sort_keys=True)
    calculated = calculate_sha256(canonical_str)

    if calculated.lower() == claimed_checksum.lower():
        print(f"[OK] SHA-256 Integrity Verified: {claimed_checksum[:12]}...")
        return True
    else:
        print(f"[ERROR] Checksum Mismatch! Claimed: {claimed_checksum[:12]} vs Computed: {calculated[:12]}")
        return False


def save_snapshot_locally(snapshot: dict, dest_dir: Path) -> Path:
    dest_dir.mkdir(parents=True, exist_ok=True)
    date_str = snapshot.get("exportedAt", datetime.utcnow().isoformat())[:10]
    home_id = snapshot.get("home", {}).get("id", "home_unknown")
    filename = f"light-tracker-backup-{home_id}-{date_str}.json"
    dest_path = dest_dir / filename

    with open(dest_path, "w", encoding="utf-8") as f:
        json.dump(snapshot, f, indent=2)

    print(f"[SUCCESS] Saved snapshot to: {dest_path}")
    return dest_path


def forward_to_webhook(snapshot: dict, webhook_url: str, secret_token: str = None) -> bool:
    headers = {
        "Content-Type": "application/json",
        "X-LightTracker-Event": "backup.snapshot.synced",
        "X-LightTracker-Checksum": snapshot.get("checksumSha256", ""),
        "X-LightTracker-Home": snapshot.get("home", {}).get("id", ""),
    }
    if secret_token:
        headers["Authorization"] = f"Bearer {secret_token}"

    data = json.dumps(snapshot).encode("utf-8")
    req = urllib.request.Request(webhook_url, data=data, headers=headers, method="POST")

    try:
        with urllib.request.urlopen(req, timeout=15) as res:
            print(f"[WEBHOOK] Dispatched successfully (HTTP {res.status})")
            return True
    except Exception as e:
        print(f"[WEBHOOK ERROR] Failed to dispatch to {webhook_url}: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description="Light Tracker Automated Backup Runner")
    parser.add_argument(
        "--source",
        default="http://localhost:3000/data/backup-latest.json",
        help="URL or local path of the backup snapshot to ingest"
    )
    parser.add_argument(
        "--dest-dir",
        default="./backups",
        help="Local directory to store timestamped backups"
    )
    parser.add_argument(
        "--webhook",
        help="Optional external webhook URL to forward the backup snapshot"
    )
    parser.add_argument(
        "--secret",
        help="Optional Bearer token for webhook authentication"
    )
    parser.add_argument(
        "--no-verify",
        action="store_true",
        help="Skip SHA-256 cryptographic verification"
    )

    args = parser.parse_args()

    print(f"--- Light Tracker Backup Runner ---")
    print(f"Source: {args.source}")

    if args.source.startswith("http://") or args.source.startswith("https://"):
        snapshot = fetch_latest_backup(args.source)
    else:
        with open(args.source, "r", encoding="utf-8") as f:
            snapshot = json.load(f)

    if not args.no_verify:
        is_valid = verify_snapshot_integrity(snapshot)
        if not is_valid:
            print("[ALERT] Aborting save due to integrity failure.")
            sys.exit(1)

    save_snapshot_locally(snapshot, Path(args.dest_dir))

    if args.webhook:
        forward_to_webhook(snapshot, args.webhook, args.secret)

    print("Backup operation completed successfully.")


if __name__ == "__main__":
    main()
