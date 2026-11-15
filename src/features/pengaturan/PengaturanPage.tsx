import {
  DatabaseBackup,
  History,
  KeyRound,
  Store,
  Users,
} from "lucide-react";

import { PageHeader } from "@/components/common/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { ActivityLogSettingsTab } from "./ActivityLogSettingsTab";
import { AkunSettingsTab } from "./AkunSettingsTab";
import { BackupSettingsTab } from "./BackupSettingsTab";
import { PegawaiSettingsTab } from "./PegawaiSettingsTab";
import { ProfilSettingsTab } from "./ProfilSettingsTab";

const tabs = [
  { value: "profil", label: "Profil & Tampilan", icon: Store },
  { value: "pegawai", label: "Pegawai", icon: Users },
  { value: "akun", label: "Akun", icon: KeyRound },
  { value: "log", label: "Log Aktivitas", icon: History },
  { value: "backup", label: "Backup", icon: DatabaseBackup },
] as const;

export function PengaturanPage() {
  return (
    <div>
      <PageHeader
        title="Pengaturan"
        description="Kelola profil usaha, pegawai, akun login, jejak aktivitas, dan cadangan data."
      />

      <Tabs defaultValue="profil" className="gap-5">
        <TabsList className="justify-start">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger key={tab.value} value={tab.value}>
                <Icon className="size-3.5" />
                {tab.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="profil">
          <ProfilSettingsTab />
        </TabsContent>
        <TabsContent value="pegawai">
          <PegawaiSettingsTab />
        </TabsContent>
        <TabsContent value="akun">
          <AkunSettingsTab />
        </TabsContent>
        <TabsContent value="log">
          <ActivityLogSettingsTab />
        </TabsContent>
        <TabsContent value="backup">
          <BackupSettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
