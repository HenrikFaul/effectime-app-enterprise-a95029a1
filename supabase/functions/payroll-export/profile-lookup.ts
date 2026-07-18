export const PROFILE_LOOKUP_BATCH_SIZE = 200;

interface ProfileRow {
  user_id: string;
  display_name: string | null;
}

interface ProfileLookupResult {
  data: ProfileRow[] | null;
  error: { message?: string } | null;
}

export interface ProfileLookupClient {
  from(table: 'profiles'): {
    select(columns: 'user_id, display_name'): {
      in(column: 'user_id', values: string[]): PromiseLike<ProfileLookupResult>;
    };
  };
}

export async function loadProfileNamesByUserId(
  client: ProfileLookupClient,
  userIds: string[],
): Promise<Map<string, string | null>> {
  const uniqueUserIds = [...new Set(userIds.filter((userId) => typeof userId === 'string' && userId.length > 0))];
  const profileNames = new Map<string, string | null>();

  for (let offset = 0; offset < uniqueUserIds.length; offset += PROFILE_LOOKUP_BATCH_SIZE) {
    const batch = uniqueUserIds.slice(offset, offset + PROFILE_LOOKUP_BATCH_SIZE);
    let result: ProfileLookupResult;
    try {
      result = await client
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', batch);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown database error';
      throw new Error(`Failed to load member profiles: ${message}`);
    }
    if (result.error) {
      throw new Error(`Failed to load member profiles: ${result.error.message || 'Unknown database error'}`);
    }
    for (const profile of result.data || []) {
      profileNames.set(profile.user_id, profile.display_name);
    }
  }

  return profileNames;
}
