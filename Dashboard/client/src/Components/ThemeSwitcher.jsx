import React, { useState, useEffect } from "react";
import "./ThemeSwitcher.css";

const ThemeSwitcher = () => {
    const [isDarkMode, setIsDarkMode] = useState(
        localStorage.getItem("theme") === "dark"
    );

    useEffect(() => {
        if (isDarkMode) {
            document.body.classList.add("dark-mode");
            localStorage.setItem("theme", "dark");
        } else {
            document.body.classList.remove("dark-mode");
            localStorage.setItem("theme", "light");
        }
    }, [isDarkMode]);

    return (
        <button
            className={`theme-switch ${isDarkMode ? 'dark' : 'light'}`}
            onClick={() => setIsDarkMode(!isDarkMode)}
            aria-label="Toggle theme"
        >
            <div className="switch-track">
                <div className="switch-thumb">
                    <span className="icon">{isDarkMode ? '🌙' : '☀️'}</span>
                </div>
            </div>
        </button>
    );
};

export default ThemeSwitcher;
