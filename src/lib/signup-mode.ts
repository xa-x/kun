/**
 * Account-creation gate. Invite-only while under development — the sign-up
 * page and the /api/auth/signup route both consult this flag, so flipping it
 * to true reopens self-serve signup everywhere at once.
 */
export const SIGNUP_OPEN = false;
