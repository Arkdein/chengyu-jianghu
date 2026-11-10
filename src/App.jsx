import { useEffect } from 'preact/hooks';
import { useRoute } from './lib/hooks.js';
import { loadAudioManifest } from './lib/audio.js';
import { Home } from './screens/Home.jsx';
import { Library } from './screens/Library.jsx';
import { Learn } from './screens/Learn.jsx';
import { Run } from './screens/Run.jsx';
import { Records } from './screens/Records.jsx';
import { Settings } from './screens/Settings.jsx';
import { Skills } from './screens/Skills.jsx';
import { Story } from './screens/Story.jsx';

const TABS = [
  ['#/', 'home', '书院', 'Home'],
  ['#/library', 'library', '藏经阁', 'Learn'],
  ['#/skills', 'skills', '武学', 'Skills'],
  ['#/records', 'records', '战绩', 'Records'],
  ['#/settings', 'settings', '设置', 'Settings'],
];

export function App() {
  const route = useRoute();
  useEffect(() => { loadAudioManifest(); }, []);
  const inRun = route.name === 'run';
  return (
    <>
      {route.name === 'home' && <Home />}
      {route.name === 'library' && <Library ch={route.ch} />}
      {route.name === 'learn' && <Learn id={route.id} />}
      {route.name === 'run' && <Run mode={route.mode} />}
      {route.name === 'records' && <Records />}
      {route.name === 'settings' && <Settings />}
      {route.name === 'skills' && <Skills />}
      {route.name === 'story' && <Story />}
      {!inRun && (
        <nav class="nav" aria-label="主菜单">
          <div class="nav-in">
            {TABS.map(([href, name, zh, en]) => (
              <a href={href} class={route.name === name || (name === 'library' && route.name === 'learn') || (name === 'home' && route.name === 'story') ? 'on' : ''}>
                <b>{zh}</b>{en}
              </a>
            ))}
          </div>
        </nav>
      )}
    </>
  );
}
