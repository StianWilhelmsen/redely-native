/**
 * What onboarding has collected before the household exists (steps 1-3). Held in memory:
 * if the app restarts before step 3 the person simply starts again, and once the
 * household exists everything lives on the server and onboarding resumes at step 4.
 *
 * The ids written back (`createdHid`, child `memberId`s) make step 3 safe to retry: a
 * failure halfway never creates a second household or a duplicate child.
 */

import type { HouseholdType, MemberColor, PhotoFile, Uuid } from '@/api';
import { MemberColors } from '@/constants/theme';

export type HomeChoice = 'family' | 'couple' | 'twoHomes' | 'shared';

export const HOME_CHOICE_TYPE: Record<HomeChoice, HouseholdType> = {
  family: 'FAMILY',
  couple: 'COUPLE',
  // Linking two homes comes later; for now it is a family door like any other.
  twoHomes: 'FAMILY',
  shared: 'SHARED_HOME',
};

export type DraftPerson = {
  key: string;
  name: string;
  role: 'ADULT' | 'CHILD';
  birthYear: number | null;
  color: MemberColor;
  /** Set once the profile exists on the server (children only). */
  memberId?: Uuid;
};

export type OnboardingDraft = {
  choice: HomeChoice;
  name: string;
  homeName: string;
  color: MemberColor;
  photo: PhotoFile | null;
  photoUploaded: boolean;
  people: DraftPerson[];
  createdHid: Uuid | null;
  myMemberId: Uuid | null;
};

const initial = (): OnboardingDraft => ({
  choice: 'family',
  name: '',
  homeName: '',
  color: MemberColors[0],
  photo: null,
  photoUploaded: false,
  people: [],
  createdHid: null,
  myMemberId: null,
});

let draft: OnboardingDraft = initial();

export function getDraft(): OnboardingDraft {
  return draft;
}

export function updateDraft(patch: Partial<OnboardingDraft>) {
  draft = { ...draft, ...patch };
}

export function resetDraft() {
  draft = initial();
}

/** The adults named in step 3 - they get the invitation in step 4. */
export function draftAdultNames(): string[] {
  return draft.people.filter((p) => p.role === 'ADULT').map((p) => p.name);
}

/** The next colour nobody in the list has yet, so previews match what the door will show. */
export function nextFreeColor(taken: readonly string[]): MemberColor {
  return (MemberColors.find((c) => !taken.includes(c)) ?? MemberColors[taken.length % MemberColors.length]) as MemberColor;
}

export const COLOR_NAMES: Record<MemberColor, 'blue' | 'purple' | 'teal' | 'mustard' | 'pink' | 'grass'> = {
  '#2F5BD8': 'blue',
  '#7A4FD6': 'purple',
  '#1A9AA6': 'teal',
  '#E8B400': 'mustard',
  '#E0559A': 'pink',
  '#5E9E2E': 'grass',
};
