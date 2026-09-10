export default {
  '{apps,packages}/**/*.{ts,tsx}': [
    'eslint --max-warnings=0 --no-warn-ignored',
    'prettier --check',
  ],
  '*.{js,mjs,cjs,json,md,css,yml,yaml,html}': 'prettier --check',
};
