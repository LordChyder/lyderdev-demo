export interface SearchUserDto {
  userId: number;
  username: string | null;
  name: string | null;
  email: string | null;
  isAdministrator: boolean;
  allowedGeneralSetting: boolean;
}

export interface SearchUsersParams {
  pageIndex: number;
  pageSize: number;
  filter?: string;
}

export interface SaveUserDto {
  username: string;
  name: string;
  email: string;
  password: string;
  isAdministrator: boolean;
  allowedGeneralSetting: boolean;
}

export interface UserUpdateDto {
  username: string;
  name: string;
  email: string;
  isAdministrator: boolean;
  allowedGeneralSetting: boolean;
}

export interface UserGetForEditDto {
  id: number;
  username: string | null;
  name: string | null;
  email: string | null;
  active: boolean;
  isAdministrator: boolean;
  allowedGeneralSetting: boolean;
}
