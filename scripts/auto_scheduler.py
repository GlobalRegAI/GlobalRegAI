# Master Auto-Scheduler Daemon (Daily 12:00 KST / Weekly / Monthly)
import sys
import os
import time
import schedule
import datetime
import subprocess

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
sys.stderr.reconfigure(encoding='utf-8', errors='replace')

def job_daily_kst_12_unresolved_query_analysis():
    print(f"\n⏰ [JOB TRIGGERED: {datetime.datetime.now()}] Daily KST 12:00 Unresolved Query Self-Healing Analysis", flush=True)
    try:
        from scripts.unresolved_query_analyzer import analyze_and_heal_unresolved_queries
        analyze_and_heal_unresolved_queries()
    except Exception as e:
        print(f"❌ Daily Job Error: {e}", flush=True)

def job_weekly_50_persona_simulation():
    print(f"\n⏰ [JOB TRIGGERED: {datetime.datetime.now()}] Weekly 50-Persona Global RA/QA Audit Simulation", flush=True)
    try:
        from test_50_global_ra_qa_simulation import run_50_global_ra_qa_simulation
        run_50_global_ra_qa_simulation()
    except Exception as e:
        print(f"❌ Weekly Job Error: {e}", flush=True)

def job_monthly_structural_audit():
    print(f"\n⏰ [JOB TRIGGERED: {datetime.datetime.now()}] Monthly Full Structural Health Audit", flush=True)
    try:
        from scripts.full_structure_auditor import run_monthly_structural_audit
        run_monthly_structural_audit()
    except Exception as e:
        print(f"❌ Monthly Job Error: {e}", flush=True)

def main():
    if "--test-run" in sys.argv:
        print("=== EXECUTING TEST RUN OF ALL SCHEDULED JOBS ===", flush=True)
        job_daily_kst_12_unresolved_query_analysis()
        job_weekly_50_persona_simulation()
        job_monthly_structural_audit()
        print("=== TEST RUN COMPLETE ===", flush=True)
        return

    print("=== GLOBALREGAI MASTER AUTO-SCHEDULER DAEMON STARTED ===", flush=True)
    print("• Daily Job: KST 12:00 PM (Unresolved Query Self-Healing Analysis)")
    print("• Weekly Job: Every Monday 09:00 AM (50-Persona Global RA/QA Audit Simulation)")
    print("• Monthly Job: 1st of Every Month 00:00 (Full Structural Health Audit)\n", flush=True)

    # Schedule definitions
    schedule.every().day.at("12:00").do(job_daily_kst_12_unresolved_query_analysis)
    schedule.every().monday.at("09:00").do(job_weekly_50_persona_simulation)
    schedule.every(30).days.do(job_monthly_structural_audit)

    while True:
        schedule.run_pending()
        time.sleep(30)

if __name__ == "__main__":
    main()
