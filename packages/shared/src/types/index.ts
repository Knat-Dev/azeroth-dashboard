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

// API response shapes

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface ContainerHealth {
  state: string;
  status: string;
  crashLoop?: boolean;
}

export interface HealthState {
  worldserver: ContainerHealth;
  authserver: ContainerHealth;
  soap: { connected: boolean; degraded?: boolean };
  players: { online: number };
  lastUpdated: string;
  uptime?: string;
  realmName?: string;
}

export interface ServerEvent {
  id: number;
  timestamp: string;
  container: string;
  event_type: string;
  details: string | null;
  duration_ms: number | null;
}

export interface OnlinePlayer {
  guid: number;
  name: string;
  level: number;
  class: number;
  race: number;
  gender: number;
  zone: number;
  map: number;
  money?: number;
  totaltime?: number;
  guildName?: string;
}

export interface PlayerDetail {
  guid: number;
  name: string;
  level: number;
  class: number;
  race: number;
  gender: number;
  zone: number;
  map: number;
  money: number;
  totaltime: number;
  totalKills: number;
  arenaPoints: number;
  totalHonorPoints: number;
  health: number;
  power1: number;
  positionX: number;
  positionY: number;
  positionZ: number;
  account: number;
  online: number;
  equipmentCache: string | null;
  guildName: string | null;
  guildRank: number | null;
}

export interface DistributionEntry {
  id: number;
  count: number;
}

export interface DistributionData {
  classes: DistributionEntry[];
  races: DistributionEntry[];
}

export interface BanEntry {
  id: number;
  accountId: number;
  username: string;
  reason: string;
  bannedBy: string;
  banDate: string;
  unbanDate: string;
}

export interface User {
  id: number;
  username: string;
  email: string;
  gmLevel: number;
}

export interface ContainerInfo {
  name: string;
  state: string;
  status: string;
}

export interface PlayerHistoryPoint {
  timestamp: string;
  count: number;
}

export interface AccountListItem {
  id: number;
  username: string;
  email: string;
  gmLevel: number;
  lastLogin: string;
}
