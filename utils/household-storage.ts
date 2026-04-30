import KVStore from 'expo-sqlite/kv-store';
import { generateId } from './id';

export interface HouseholdMember {
  id: string;
  name: string;
  emoji: string;
  role: 'owner' | 'member';
  joinedAt: string;
}

export interface HouseholdProfile {
  userId: string;
  displayName: string;
  userEmoji: string;
  imageUri?: string;
  householdName: string;
  householdCode: string;
  members: HouseholdMember[];
  createdAt: string;
}

const KEY = '@household_profile';

const EMOJIS = ['👤', '👦', '👧', '👨', '👩', '🧑', '👴', '👵', '🧒'];

function randomEmoji(): string {
  return EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
}

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function loadHousehold(): Promise<HouseholdProfile | null> {
  const raw = await KVStore.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as HouseholdProfile;
  } catch {
    return null;
  }
}

export async function saveHousehold(profile: HouseholdProfile): Promise<void> {
  await KVStore.setItem(KEY, JSON.stringify(profile));
}

export async function createHousehold(displayName: string, householdName: string): Promise<HouseholdProfile> {
  const now = new Date().toISOString();
  const profile: HouseholdProfile = {
    userId: generateId(),
    displayName,
    userEmoji: randomEmoji(),
    householdName,
    householdCode: generateCode(),
    members: [
      {
        id: generateId(),
        name: displayName,
        emoji: randomEmoji(),
        role: 'owner',
        joinedAt: now,
      },
    ],
    createdAt: now,
  };
  await saveHousehold(profile);
  return profile;
}

export async function addMember(profile: HouseholdProfile, name: string): Promise<HouseholdProfile> {
  const member: HouseholdMember = {
    id: generateId(),
    name,
    emoji: randomEmoji(),
    role: 'member',
    joinedAt: new Date().toISOString(),
  };
  const updated = { ...profile, members: [...profile.members, member] };
  await saveHousehold(updated);
  return updated;
}

export async function removeMember(profile: HouseholdProfile, memberId: string): Promise<HouseholdProfile> {
  const updated = { ...profile, members: profile.members.filter((m) => m.id !== memberId) };
  await saveHousehold(updated);
  return updated;
}

export async function updateProfile(
  profile: HouseholdProfile,
  changes: Partial<Pick<HouseholdProfile, 'displayName' | 'householdName' | 'imageUri'>>
): Promise<HouseholdProfile> {
  const updated = { ...profile, ...changes };
  await saveHousehold(updated);
  return updated;
}

export async function regenerateCode(profile: HouseholdProfile): Promise<HouseholdProfile> {
  const updated = { ...profile, householdCode: generateCode() };
  await saveHousehold(updated);
  return updated;
}
