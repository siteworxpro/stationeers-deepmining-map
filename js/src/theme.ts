import {themeToggle} from "./elements.ts";

let currentTheme = localStorage.getItem('theme') || 'dark';

const lightThemeIcon = 'fa-solid fa-lightbulb';
const darkThemeIcon = 'fa-solid fa-moon';

applyTheme(currentTheme)

function applyTheme(theme: string) {
    document.body.className = theme;
    localStorage.setItem('theme', theme);
    currentTheme = theme;

    const icon = document.createElement('i');
    icon.className = theme === 'light' ? darkThemeIcon : lightThemeIcon;
    const existingIcon = themeToggle?.querySelector('i');
    if (existingIcon) {
        themeToggle?.replaceChild(icon, existingIcon);
    } else {
        themeToggle?.appendChild(icon);
    }
}

export function onClickThemeToggle() {
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    applyTheme(newTheme);
}
