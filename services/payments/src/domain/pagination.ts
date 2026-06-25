export interface Page {
  limit: number;
  offset: number;
}

export interface ListResult<T> {
  items: T[];
  total: number;
}
