export function currentUserId(ctx: unknown): number | undefined {
  const c = ctx as { auth?: { user?: { id?: number } }; state?: { currentUserId?: number; currentUser?: { id?: number } } };
  return c.auth?.user?.id ?? c.state?.currentUserId ?? c.state?.currentUser?.id;
}
