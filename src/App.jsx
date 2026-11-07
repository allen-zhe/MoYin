import { MainApp } from './MainApp.jsx';
import { QuickApp } from './QuickApp.jsx';

export default function App() {
  const isQuick = window.location.hash.includes('quick');
  return isQuick ? <QuickApp /> : <MainApp />;
}
