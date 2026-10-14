"use client";

import { useEffect, useState } from "react";
import { readJson } from "@/lib/http";
import type { PlatformSettings } from "@/lib/platform";
import { toast } from "../Toast";
import { AdminPage } from "./ui";
import { useAdminData } from "./useAdminData";

export function SettingsAdmin() {
  const { data, error, reload } = useAdminData<{ settings: PlatformSettings }>("/api/admin/settings");
  const [msg, setMsg] = useState("");
  const [ann, setAnn] = useState("");
  const [level, setLevel] = useState<"info" | "warn">("info");

  useEffect(() => {
    if (!data) return;
    const t = setTimeout(() => {
      setMsg(data.settings.maintenance.message);
      setAnn(data.settings.announcement.text);
      setLevel(data.settings.announcement.level);
    }, 0);
    return () => clearTimeout(t);
  }, [data]);

  const save = async (patch: object, done: string) => {
    const res = await fetch("/api/admin/settings", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(patch) });
    const j = await readJson<{ error?: string }>(res).catch(() => ({} as { error?: string }));
    if (!res.ok) return toast(j.error || "Couldn’t save.", "error");
    toast(done, "ok");
    await reload();
  };
  const s = data?.settings;

  return (
    <AdminPage title="Settings" description="Switches that take effect immediately, without a deploy.">
      {error && <p className="mb-3 text-[13px] text-err">{error}</p>}
      {!s ? (
        <div className="kun-skeleton h-56" aria-busy />
      ) : (
        <div className="max-w-2xl space-y-10">
          <section>
            <h2 className="text-[15px] font-medium text-ink">Announcement banner</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">A line shown at the top of the signed-in app for everyone. Use it for planned downtime or news.</p>
            <label htmlFor="ann" className="mb-1.5 mt-4 block text-[13px] font-medium text-ink">
              Message
            </label>
            <input id="ann" value={ann} onChange={(e) => setAnn(e.target.value)} maxLength={240} className="kun-input" placeholder="Scheduled maintenance tonight at 22:00 UTC." />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <select value={level} onChange={(e) => setLevel(e.target.value as "info" | "warn")} aria-label="Style" className="kun-input !h-10 !w-auto !text-[13px]">
                <option value="info">Info</option>
                <option value="warn">Warning</option>
              </select>
              <button type="button" disabled={!ann.trim()} onClick={() => void save({ announcement: { on: true, text: ann, level } }, "Banner is live.")} className="kun-btn-primary h-10 rounded-full px-5 text-[13px] font-medium disabled:opacity-50">
                {s.announcement.on ? "Update banner" : "Show banner"}
              </button>
              {s.announcement.on && (
                <button type="button" onClick={() => void save({ announcement: { on: false } }, "Banner hidden.")} className="kun-btn-secondary h-10 rounded-full px-5 text-[13px] font-medium">
                  Hide
                </button>
              )}
            </div>
          </section>

          <section className="border-t border-line pt-8">
            <h2 className="text-[15px] font-medium text-ink">Maintenance mode</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">
              Refuses new runs (everything else keeps working; runs already in progress finish). Users see the message below when they press Run.
            </p>
            <label htmlFor="maint" className="mb-1.5 mt-4 block text-[13px] font-medium text-ink">
              Message shown to users
            </label>
            <input id="maint" value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={200} className="kun-input" />
            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={() => void save({ maintenance: { on: !s.maintenance.on, message: msg } }, s.maintenance.on ? "Runs are back on." : "Maintenance mode is on: new runs are paused.")}
                className={`h-10 rounded-full px-5 text-[13px] font-medium ${s.maintenance.on ? "kun-btn-secondary" : "bg-warn/90 text-black"}`}
              >
                {s.maintenance.on ? "Turn off maintenance" : "Pause new runs"}
              </button>
              {s.maintenance.on && <span className="text-[12.5px] text-warn">New runs are paused.</span>}
            </div>
          </section>
        </div>
      )}
    </AdminPage>
  );
}
