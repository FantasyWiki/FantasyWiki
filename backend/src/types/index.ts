export interface GoogleProfile {
  id: string;
  displayName: string;
  email: string;
  picture: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  picture: string;
  iat?: number;
  exp?: number;
}
