type Session = { user: { id: string } };
type SessionResult<T> = { data: { session: T | null }; error: unknown };

// A failed token refresh is not proof of sign-out. Never use the cached
// profile as permission to publish; protected writes still use the SDK/RLS.
export async function publicationSession<T extends Session>(
  getSession: () => PromiseLike<SessionResult<T>>,
): Promise<{ status: "ready"; session: T } | { status: "unavailable" } | { status: "signed-out" }> {
  try {
    const { data, error } = await getSession();
    if (error) return { status: "unavailable" };
    if (!data.session?.user?.id) return { status: "signed-out" };
    return { status: "ready", session: data.session };
  } catch {
    return { status: "unavailable" };
  }
}
