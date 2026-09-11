import { useState } from "react";
import { Mail, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IMAP_PRESETS } from "@/lib/subscriptions/mail-accounts";
import { useLedger } from "@/lib/subscriptions/store";
import { MAX_MAILBOXES } from "@/lib/subscriptions/types";

type Props = {
  passwords: Record<string, string>;
  onPassword: (id: string, pass: string) => void;
};

export function MailboxesPanel({ passwords, onPassword }: Props) {
  const mailboxes = useLedger((s) => s.mailboxes);
  const addMailbox = useLedger((s) => s.addMailbox);
  const removeMailbox = useLedger((s) => s.removeMailbox);
  const [presetId, setPresetId] = useState("gmail");
  const [host, setHost] = useState("imap.gmail.com");
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");

  function applyPreset(id: string) {
    setPresetId(id);
    const preset = IMAP_PRESETS.find((p) => p.id === id);
    if (preset?.host) setHost(preset.host);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const preset = IMAP_PRESETS.find((p) => p.id === presetId);
    const result = addMailbox({
      label: preset && preset.id !== "custom" ? preset.label : user,
      host,
      port: preset?.port ?? 993,
      user,
    });
    if (result !== "ok") {
      if (result === "duplicate") toast.error("That mailbox is already listed");
      else if (result === "full") toast.error(`Up to ${MAX_MAILBOXES} extra mailboxes`);
      else toast.error("Need host and address");
      return;
    }
    const saved = useLedger.getState().mailboxes.find(
      (box) => box.user === user.trim() && box.host === host.trim().toLowerCase(),
    );
    if (saved && pass) onPassword(saved.id, pass);
    toast(`Added ${user}. App password stays on this device.`);
    setUser("");
    setPass("");
  }

  return (
    <section className="rounded-3xl bg-card p-5 shadow-[var(--shadow-border)]">
      <h2 className="font-display text-2xl font-medium tracking-tight">Mailboxes</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        IMAP for Gmail, Outlook, iCloud, Yahoo. Use an app password, not the account password.
      </p>
      {mailboxes.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-2">
          {mailboxes.map((box) => (
            <li key={box.id} className="flex flex-col gap-2 rounded-2xl bg-secondary px-4 py-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{box.user}</p>
                <p className="truncate text-xs text-muted-foreground">{box.label} · {box.host}</p>
              </div>
              <Input type="password" autoComplete="off" placeholder="App password" value={passwords[box.id] ?? ""} onChange={(e) => onPassword(box.id, e.target.value)} className="sm:max-w-44" />
              <Button type="button" variant="ghost" size="icon" className="size-9" onClick={() => removeMailbox(box.id)}>
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      <form className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2" onSubmit={submit}>
        <div className="flex flex-col gap-1.5">
          <Label>Provider</Label>
          <Select value={presetId} onValueChange={applyPreset}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {IMAP_PRESETS.map((preset) => (
                <SelectItem key={preset.id} value={preset.id}>{preset.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="imap-host">IMAP host</Label>
          <Input id="imap-host" value={host} onChange={(e) => setHost(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="imap-user">Email</Label>
          <Input id="imap-user" type="email" value={user} onChange={(e) => setUser(e.target.value)} placeholder="you@icloud.com" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="imap-pass">App password</Label>
          <Input id="imap-pass" type="password" autoComplete="off" value={pass} onChange={(e) => setPass(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={!user.trim() || !host.trim()}>
            <Plus className="size-4" /> Add mailbox
          </Button>
        </div>
      </form>
    </section>
  );
}
