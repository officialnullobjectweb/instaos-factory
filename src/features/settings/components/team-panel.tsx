"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InitialsAvatar } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SettingsRow,
  SettingsSection,
} from "@/features/settings/components/settings-row";
import { toast } from "@/lib/toast";
import type { BrandId } from "@/types";

interface Member {
  id: string;
  name: string;
  email: string;
  initials: string;
  role: "Owner" | "Reviewer" | "Contributor";
  brands: BrandId[] | "all";
}

const MEMBERS: Member[] = [
  {
    id: "usr-1",
    name: "Kamal Dhiver",
    email: "kamal@factory.os",
    initials: "KD",
    role: "Owner",
    brands: "all",
  },
  {
    id: "usr-2",
    name: "Ava Lindqvist",
    email: "ava@midnightritual.co",
    initials: "AL",
    role: "Reviewer",
    brands: ["midnight-ritual"],
  },
  {
    id: "usr-3",
    name: "Noah Reyes",
    email: "noah@studionoir.com",
    initials: "NR",
    role: "Reviewer",
    brands: ["studio-noir"],
  },
  {
    id: "usr-4",
    name: "Mira Chen",
    email: "mira@thedailygrind.io",
    initials: "MC",
    role: "Contributor",
    brands: ["daily-grind"],
  },
];

export function TeamPanel() {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Member["role"]>("Reviewer");

  return (
    <div className="flex flex-col gap-5">
      <SettingsSection
        title="Members"
        description="Roles decide who can approve, schedule and publish."
      >
        {MEMBERS.map((member) => (
          <SettingsRow
            key={member.id}
            title={member.name}
            description={member.email}
          >
            <div className="flex flex-wrap items-center gap-3">
              <InitialsAvatar
                initials={member.initials}
                tone={member.role === "Owner" ? "ink" : "muted"}
                className={member.role === "Owner" ? "border-0" : undefined}
              />
              <Badge tone={member.role === "Owner" ? "accent" : "neutral"} size="sm">
                {member.role}
              </Badge>
              <span className="text-[12px] text-ink-2">
                {member.brands === "all"
                  ? "All brands"
                  : `${member.brands.length} brand`}
              </span>
            </div>
          </SettingsRow>
        ))}
      </SettingsSection>

      <SettingsSection
        title="Invite a reviewer"
        description="Reviewers can approve or send content back, but cannot publish directly."
        footer={
          <Button
            variant="primary"
            size="sm"
            disabled={inviteEmail.trim().length === 0}
            onClick={() => {
              toast.success("Invitation sent", { description: inviteEmail });
              setInviteEmail("");
            }}
          >
            Send invite
          </Button>
        }
      >
        <SettingsRow title="Email address" stacked>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              type="email"
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              placeholder="teammate@studio.com"
              aria-label="Invite email address"
              className="sm:max-w-sm"
            />
            <Select
              value={inviteRole}
              onValueChange={(value) => setInviteRole(value as Member["role"])}
            >
              <SelectTrigger className="sm:w-40" aria-label="Role">
                <SelectValue>{inviteRole}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Reviewer">Reviewer</SelectItem>
                <SelectItem value="Contributor">Contributor</SelectItem>
                <SelectItem value="Owner">Owner</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </SettingsRow>
      </SettingsSection>
    </div>
  );
}
