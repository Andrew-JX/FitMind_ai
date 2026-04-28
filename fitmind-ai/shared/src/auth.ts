export interface AuthUserDto {
  id: string;
  email: string;
  display_name: string | null;
}

export interface RegisterRequest {
  email: string;
  password: string;
  display_name?: string | undefined;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthSuccessData {
  user: AuthUserDto;
  token: string;
}

export interface MeResponseData {
  user: AuthUserDto;
}
