# Hardware Installation Runbook

> Follow this checklist for every pilot home installation.
> Each install should take 30–60 minutes including verification.

---

## What You Bring

- [ ] 2x Tuya/Sonoff smart plugs (already linked to your team's Tuya account)
- [ ] A multimeter or plug-in socket tester (optional but recommended)
- [ ] Your phone (to verify live dashboard updates)
- [ ] The paper validation log template

---

## Step 1: Identify the Grid-Only Circuit

This is the most critical step. Sensor A must be on a socket that is grid-only — no inverter or generator bypass.

**How to verify:**
1. Ask the household: "Which sockets go off immediately when NEPA cuts?" Those are grid-only.
2. If they have a distribution board, identify which breaker is the raw incoming mains circuit before any change-over switch.
3. Plug in a lamp or phone charger, then ask them to manually switch the inverter on. If the lamp stays on, the socket has backup — do not use it for Sensor A.
4. The correct grid-only socket goes dark immediately when NEPA cuts.

**If no grid-only socket exists:** The household needs an electrician to add a single dedicated socket on the incoming grid circuit before the change-over switch. Do not proceed without this.

---

## Step 2: Identify the Inverter/Backup Circuit

Sensor B goes here. This is any socket that stays live when the grid fails because the inverter or UPS powers it.

**Critical requirement: The Wi-Fi router must also be on this circuit.**

If the router is on the grid circuit, when NEPA cuts, the router dies and both sensors disappear from the internet. The system will have to log UNKNOWN for every real outage.

**How to verify:**
1. Ask the household to disconnect the router power and plug it back in on the inverter circuit.
2. Or confirm the router already has its own UPS/power bank.
3. Test: simulate a brief power cut (switch off the mains breaker for 10 seconds). The router should stay on and remain connected to the internet.

---

## Step 3: Register Sensors in the App

Before plugging in:
1. Open the Light Tracker admin panel or ask your backend developer to register the two sensor device IDs for this home.
2. Assign Sensor A role = `GRID`, Sensor B role = `BACKUP`.
3. Note the `homeId` generated for this home.

---

## Step 4: Install and Verify

1. Plug Sensor A into the grid-only socket.
2. Plug Sensor B into the inverter/backup socket (near the router).
3. Connect both to Wi-Fi (use the Tuya/Smart Life app, or use the provisioning QR code process).
4. Confirm both sensors show as ONLINE in your backend device-health endpoint.
5. Open the Light Tracker dashboard for this home. You should see state = `ON` with `confidence: HIGH`.

---

## Step 5: Acceptance Test

Perform this test before you leave.

1. **Confirm ON state:** Dashboard shows ON with both sensors online. ✅
2. **Simulate grid off:** Briefly switch off the grid-only breaker or unplug Sensor A manually.
   - Expected: Dashboard changes to OFF within 2–4 minutes (after debounce).
   - If it shows UNKNOWN: check that Sensor B and the router are still online.
3. **Restore grid:** Switch the breaker back on.
   - Expected: Dashboard returns to ON within 2–4 minutes.
4. **Simulate internet failure:** Briefly disconnect the router.
   - Expected: Dashboard shows UNKNOWN (not OFF).
   - This is the most important test. A false OFF here means the installation is incorrect.

Only leave if all four tests pass.

---

## Step 6: Hand Off to the Household

Give the occupants:
- The web app link bookmarked on their phone
- A 2-minute verbal explanation of ON, OFF, and UNKNOWN
- The paper validation log (for the first 48 hours)
- Your WhatsApp number for any issues

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|:---|:---|:---|
| Both sensors show offline | Router not on backup power | Move router to inverter circuit |
| Sensor A shows offline but grid is on | Tuya account not linked / wrong device ID | Re-provision the plug |
| State shows UNKNOWN even during outage | Sensor B is on grid circuit, not backup | Move Sensor B to inverter socket |
| State shows OFF but power is fine | Sensor A plug fallen out / tripped breaker | Check the socket |
| State never updates | Polling worker not running | Check backend logs |
