/// <reference types="vite/client" />

type SBConnectConfig = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  driveUploadEndpoint: string;
  driveUploadToken?: string;
  auditLogEndpoint?: string;
  auditLogToken?: string;
};

interface Window {
  SB_CONNECT_CONFIG?: SBConnectConfig;
  Swal?: {
    fire: (options: Record<string, unknown>) => Promise<{ isConfirmed?: boolean }>;
  };
}
