export interface Account {
  id: number;
  username: string;
  email: string;
  joindate: Date;
  last_ip: string;
  last_login: Date;
  online: number;
  expansion: number;
  locale: number;
}

export interface AccountAccess {
  AccountID: number;
  SecurityLevel: number;
  RealmID: number;
  Comment: string;
}

export interface Character {
  guid: number;
  account: number;
  name: string;
  race: number;
  class: number;
  gender: number;
  level: number;
  money: number;
  online: number;
  totaltime: number;
  zone: number;
  map: number;
  health: number;
  power1: number;
  equipmentCache: string;
}

export interface Guild {
  guildid: number;
  name: string;
  leaderguid: number;
  EmblemStyle: number;
  EmblemColor: number;
  BorderStyle: number;
  BorderColor: number;
  BackgroundColor: number;
  info: string;
  motd: string;
  createdate: number;
}

export interface GuildMember {
  guildid: number;
  guid: number;
  rank: number;
  pnote: string;
  offnote: string;
}

export interface Realm {
  id: number;
  name: string;
  address: string;
  localAddress: string;
  port: number;
  icon: number;
  flag: number;
  timezone: number;
  population: number;
}

export interface ServerStatus {
  online: boolean;
  playerCount: number;
  maxPlayers: number;
  uptime: string;
  realmName: string;
}

export interface AuthLog {
  time: number;
  realm: number;
  type: string;
  level: number;
  string: string;
}

export interface IpActionLog {
  account_id: number;
  character_guid: number;
  type: number;
  ip: string;
  systemnote: string;
  unixtime: number;
  comment: string;
}

export interface Autobroadcast {
  realmid: number;
  id: number;
  weight: number;
  text: string;
}

export interface BackupInfo {
  filename: string;
  size: number;
  databases: string[];
  createdAt: Date;
}

export interface BackupSchedule {
  enabled: boolean;
  cron: string;
  databases: string[];
  retentionDays: number;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
  email?: string;
}

export interface AuthResponse {
  accessToken: string;
  user: {
    id: number;
    username: string;
    email: string;
    gmLevel: number;
  };
}
