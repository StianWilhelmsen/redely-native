import * as ImagePicker from 'expo-image-picker';
import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api, type Household, type Member, type PhotoFile, type UpdateMemberInput } from '@/api';
import { useHousehold, useMeState } from '@/state/household';

function replaceMember(h: Household | undefined, next: Member): Household | undefined {
  return h && { ...h, members: h.members.map((m) => (m.id === next.id ? next : m)) };
}

/**
 * Editing a member: optimistic on the household cache, then the server's answer, and
 * /api/me refreshed when it was me (my name, colour and photo also live there).
 */
export function useMemberActions() {
  const { t } = useTranslation();
  const { hid, mutateHousehold } = useHousehold();
  const { mutateMe } = useMeState();

  const settle = useCallback(
    (next: Member) => {
      mutateHousehold((h) => replaceMember(h, next), { revalidate: false });
      if (next.isMe) mutateMe();
      return next;
    },
    [mutateHousehold, mutateMe]
  );

  const update = useCallback(
    async (member: Member, patch: Partial<UpdateMemberInput>) => {
      const input: UpdateMemberInput = {
        displayName: member.displayName,
        role: member.role,
        color: member.color,
        birthYear: member.birthYear,
        ...patch,
      };
      mutateHousehold((h) => replaceMember(h, { ...member, ...input }), { revalidate: false });
      try {
        return settle(await api.members.update(hid, member.id, input));
      } catch (e) {
        mutateHousehold();
        throw e;
      }
    },
    [hid, mutateHousehold, settle]
  );

  /** Opens the photo library (square crop). Null when the person backs out or says no. */
  const pickPhoto = useCallback(async (): Promise<PhotoFile | null> => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t('family.photo.deniedTitle'), t('family.photo.deniedBody'));
      return null;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]) return null;
    const asset = result.assets[0];
    const type = asset.mimeType ?? 'image/jpeg';
    const ext = type.split('/')[1] ?? 'jpg';
    return { uri: asset.uri, name: asset.fileName ?? `photo.${ext}`, type };
  }, [t]);

  const uploadPhoto = useCallback(
    async (member: Member, photo: PhotoFile) => settle(await api.members.uploadPhoto(hid, member.id, photo)),
    [hid, settle]
  );

  const deletePhoto = useCallback(
    async (member: Member) => settle(await api.members.deletePhoto(hid, member.id)),
    [hid, settle]
  );

  return { update, pickPhoto, uploadPhoto, deletePhoto };
}
