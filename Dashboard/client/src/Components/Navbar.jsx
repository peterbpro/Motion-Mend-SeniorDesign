import { useState } from 'react'
import '../styles.css'

function Navbar() {
    const [activeLink, setActiveLink] = useState('home');

    const handleLinkClick = (link) => {
        setActiveLink(link);
    };

    return (
        <nav>
            <ul>
                <li className={activeLink === 'home' ? 'active' : ''} onClick={() => handleLinkClick('home')}>Home</li>
                <li className={activeLink === 'about' ? 'active' : ''} onClick={() => handleLinkClick('about')}>About</li>
                <li className={activeLink === 'contact' ? 'active' : ''} onClick={() => handleLinkClick('contact')}>Contact</li>
            </ul>
        </nav>
    );
}

export default Navbar;