export function saveToLocalStorage(key: string, value: string): void {
    localStorage.setItem(key, value);
}

export function getFromLocalStorage(key: string, defaultValue: string): string {
    const value = localStorage.getItem(key);
    return value !== null ? value : defaultValue;
}