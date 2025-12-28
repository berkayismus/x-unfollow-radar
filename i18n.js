// i18n.js - Internationalization module for Twitter Auto Unfollow Extension

const I18n = {
    currentLocale: 'tr',
    translations: {},
    supportedLocales: ['tr', 'en'],

    // Initialize the i18n system
    async init() {
        // Load saved language preference
        const data = await chrome.storage.local.get(['language']);
        this.currentLocale = data.language || 'tr';

        // Load translations for current locale
        await this.loadTranslations(this.currentLocale);

        // Apply translations to the page
        this.applyTranslations();

        return this.currentLocale;
    },

    // Load translations for a specific locale
    async loadTranslations(locale) {
        try {
            const response = await fetch(chrome.runtime.getURL(`locales/${locale}.json`));
            this.translations = await response.json();
        } catch (error) {
            console.error(`Failed to load translations for ${locale}:`, error);
            // Fallback to Turkish if loading fails
            if (locale !== 'tr') {
                await this.loadTranslations('tr');
            }
        }
    },

    // Get a translation by key path (e.g., 'app.title')
    t(keyPath, replacements = {}) {
        const keys = keyPath.split('.');
        let value = this.translations;

        for (const key of keys) {
            if (value && typeof value === 'object' && key in value) {
                value = value[key];
            } else {
                console.warn(`Translation key not found: ${keyPath}`);
                return keyPath;
            }
        }

        // Replace placeholders like {count}
        if (typeof value === 'string') {
            Object.keys(replacements).forEach(placeholder => {
                value = value.replace(new RegExp(`{${placeholder}}`, 'g'), replacements[placeholder]);
            });
        }

        return value;
    },

    // Apply translations to all elements with data-i18n attribute
    applyTranslations() {
        // Translate elements with data-i18n attribute
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translation = this.t(key);

            if (translation && translation !== key) {
                element.textContent = translation;
            }
        });

        // Translate placeholders
        document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
            const key = element.getAttribute('data-i18n-placeholder');
            const translation = this.t(key);

            if (translation && translation !== key) {
                element.placeholder = translation;
            }
        });

        // Translate titles
        document.querySelectorAll('[data-i18n-title]').forEach(element => {
            const key = element.getAttribute('data-i18n-title');
            const translation = this.t(key);

            if (translation && translation !== key) {
                element.title = translation;
            }
        });

        // Update language toggle button
        const langToggle = document.getElementById('langToggle');
        if (langToggle) {
            langToggle.textContent = this.t('language.current');
            langToggle.title = this.t('language.toggle');
        }
    },

    // Change the current language
    async setLocale(locale) {
        if (!this.supportedLocales.includes(locale)) {
            console.warn(`Unsupported locale: ${locale}`);
            return false;
        }

        this.currentLocale = locale;
        await chrome.storage.local.set({ language: locale });
        await this.loadTranslations(locale);
        this.applyTranslations();

        return true;
    },

    // Toggle between supported languages
    async toggleLocale() {
        const currentIndex = this.supportedLocales.indexOf(this.currentLocale);
        const nextIndex = (currentIndex + 1) % this.supportedLocales.length;
        const nextLocale = this.supportedLocales[nextIndex];

        await this.setLocale(nextLocale);
        return nextLocale;
    },

    // Get current locale
    getLocale() {
        return this.currentLocale;
    }
};

// Export for use in popup.js
window.I18n = I18n;
