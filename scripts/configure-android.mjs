import fs from 'node:fs';
import path from 'node:path';

const androidRoot = path.resolve(process.cwd(), 'android');
const resDir = path.join(androidRoot, 'app', 'src', 'main', 'res');
const manifestPath = path.join(androidRoot, 'app', 'src', 'main', 'AndroidManifest.xml');

if (!fs.existsSync(androidRoot)) {
  console.error('Android project folder not found. Run `npx cap add android` first.');
  process.exit(1);
}

// 1. Lock MainActivity to portrait orientation for smooth mobile gameplay
if (fs.existsSync(manifestPath)) {
  let manifest = fs.readFileSync(manifestPath, 'utf8');
  if (!manifest.includes('android:screenOrientation=')) {
    manifest = manifest.replace(
      /(<activity\b[^>]*android:name="[^"]*MainActivity")/,
      '$1\n            android:screenOrientation="portrait"',
    );
    fs.writeFileSync(manifestPath, manifest, 'utf8');
  }
}

// 2. Write Bauhaus cream (#F4F1DE) colors & launch theme (removes default Capacitor splash logo)
const valuesDir = path.join(resDir, 'values');
fs.mkdirSync(valuesDir, { recursive: true });

fs.writeFileSync(
  path.join(valuesDir, 'ic_launcher_background.xml'),
  `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#F4F1DE</color>
</resources>
`,
  'utf8',
);

fs.writeFileSync(
  path.join(valuesDir, 'colors.xml'),
  `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="colorPrimary">#18181B</color>
    <color name="colorPrimaryDark">#F4F1DE</color>
    <color name="colorAccent">#E03C31</color>
    <color name="bauhausPaper">#F4F1DE</color>
</resources>
`,
  'utf8',
);

const stylesPath = path.join(valuesDir, 'styles.xml');
if (fs.existsSync(stylesPath)) {
  let styles = fs.readFileSync(stylesPath, 'utf8');
  styles = styles.replace(
    /<item name="android:background">@drawable\/splash<\/item>/g,
    '<item name="android:background">@color/bauhausPaper</item>',
  );
  fs.writeFileSync(stylesPath, styles, 'utf8');
}

// 3. Configure crisp Bauhaus Vector Adaptive Launcher Icon (razor-sharp on all Android DPIs)
const drawableDir = path.join(resDir, 'drawable');
const anyDpiDir = path.join(resDir, 'mipmap-anydpi-v26');
fs.mkdirSync(drawableDir, { recursive: true });
fs.mkdirSync(anyDpiDir, { recursive: true });

// Remove legacy v24 foreground drawable if present
const v24DrawableDir = path.join(resDir, 'drawable-v24');
if (fs.existsSync(v24DrawableDir)) {
  const legacyFg = path.join(v24DrawableDir, 'ic_launcher_foreground.xml');
  if (fs.existsSync(legacyFg)) {
    fs.unlinkSync(legacyFg);
  }
}

fs.writeFileSync(
  path.join(drawableDir, 'ic_launcher_foreground.xml'),
  `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">

    <!-- Safe-zone centered Bauhaus Word Weather Emblem -->
    <group
        android:translateX="18"
        android:translateY="18"
        android:scaleX="0.140625"
        android:scaleY="0.140625">

        <!-- Core Ink Circle (cx=268, cy=244, r=150) -->
        <path
            android:fillColor="#18181B"
            android:pathData="M118,244 a150,150 0 1,0 300,0 a150,150 0 1,0 -300,0 Z" />

        <!-- Yellow Sun Rays -->
        <path
            android:strokeColor="#F4B942"
            android:strokeWidth="16"
            android:strokeLineCap="square"
            android:pathData="M340,76 L340,108 M428,164 L460,164 M402,102 L424,80 M278,102 L256,80 M366,194 L444,272" />

        <!-- Vermilion Sun Disk (cx=340, cy=164, r=46) -->
        <path
            android:fillColor="#E03C31"
            android:strokeColor="#18181B"
            android:strokeWidth="8"
            android:pathData="M294,164 a46,46 0 1,0 92,0 a46,46 0 1,0 -92,0 Z" />

        <!-- Faceted Cobalt Cloud -->
        <path
            android:fillColor="#2B5B84"
            android:strokeColor="#18181B"
            android:strokeWidth="10"
            android:strokeLineJoin="round"
            android:pathData="M66,272 L104,218 L144,218 L164,174 L220,174 L244,218 L290,218 L310,252 L286,282 L82,282 Z" />

        <!-- Cloud Facet Lines -->
        <path
            android:strokeColor="#18181B"
            android:strokeWidth="7"
            android:strokeLineJoin="round"
            android:pathData="M104,218 L148,282 L164,174 L210,282 L220,174 L258,282 L244,218" />

        <!-- Fixed Vertical Blue Rain Lines -->
        <path
            android:strokeColor="#2B5B84"
            android:strokeWidth="12"
            android:strokeLineCap="square"
            android:pathData="M104,306 L104,394 M138,306 L138,424 M172,306 L172,378 M206,306 L206,412" />

        <!-- Signature Yellow 'W' Tile with Ink Shadow -->
        <path
            android:fillColor="#18181B"
            android:pathData="M268,316 L396,316 L396,444 L268,444 Z" />
        <path
            android:fillColor="#F4B942"
            android:strokeColor="#18181B"
            android:strokeWidth="10"
            android:pathData="M256,304 L384,304 L384,432 L256,432 Z" />
        <path
            android:strokeColor="#18181B"
            android:strokeWidth="15"
            android:strokeLineCap="square"
            android:strokeLineJoin="miter"
            android:pathData="M284,336 L300,400 L320,356 L340,400 L356,336" />
    </group>
</vector>
`,
  'utf8',
);

const adaptiveIconXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background" />
    <foreground android:drawable="@drawable/ic_launcher_foreground" />
</adaptive-icon>
`;

fs.writeFileSync(path.join(anyDpiDir, 'ic_launcher.xml'), adaptiveIconXml, 'utf8');
fs.writeFileSync(path.join(anyDpiDir, 'ic_launcher_round.xml'), adaptiveIconXml, 'utf8');

console.log('Configured Android manifest, Bauhaus launch theme, and adaptive vector game icon.');
