const SESSION_PREFIX = 'club_session_';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface ClubSession {
  clubId: string;
  clubSlug: string;
  clubName: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  loggedIn: true;
  loginAt: number;
}

export function getClubSession(slug: string): ClubSession | null {
  try {
    const raw = localStorage.getItem(SESSION_PREFIX + slug);
    if (!raw) return null;
    const session: ClubSession = JSON.parse(raw);
    if (!session.loginAt || Date.now() - session.loginAt > SESSION_TTL_MS) {
      localStorage.removeItem(SESSION_PREFIX + slug);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function setClubSession(session: Omit<ClubSession, 'loggedIn' | 'loginAt'>): void {
  const full: ClubSession = { ...session, loggedIn: true, loginAt: Date.now() };
  localStorage.setItem(SESSION_PREFIX + session.clubSlug, JSON.stringify(full));
}

export function clearClubSession(slug: string): void {
  localStorage.removeItem(SESSION_PREFIX + slug);
}
