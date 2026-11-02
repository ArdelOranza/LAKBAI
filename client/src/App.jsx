import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './AuthContext.jsx';
import { Toast, TabBar } from './ui.jsx';
import { readLocalPrefs } from './prefs.js';
import Splash from './screens/Splash.jsx';
import SignUp from './screens/SignUp.jsx';
import LogIn from './screens/LogIn.jsx';
import Preferences from './screens/Preferences.jsx';
import HomeTab from './screens/Home.jsx';
import MapTab from './screens/MapTab.jsx';
import ChatTab from './screens/ChatTab.jsx';
import SavedTab from './screens/SavedTab.jsx';
import ProfileTab from './screens/Profile.jsx';
import ProfileEdit from './screens/ProfileEdit.jsx';
import SearchResults from './screens/SearchResults.jsx';
import Browse from './screens/Browse.jsx';
import Events from './screens/Events.jsx';
import PlaceDetail from './screens/PlaceDetail.jsx';
import Emergency from './screens/Emergency.jsx';
import Itineraries from './screens/Itineraries.jsx';
import MyReviews from './screens/MyReviews.jsx';
import ItineraryView from './screens/ItineraryView.jsx';

export const FALLBACK_CENTER = { lng: 120.23, lat: 16.03 };

export default function App(){
  return <AuthProvider><Shell/></AuthProvider>;
}

function Shell(){
  const { user, loading, signOut } = useAuth();
  const [tab, setTab] = useState('home');
  const [stack, setStack] = useState([]);
  const [authStage, setAuthStage] = useState(null);   // 'signup' | 'login' override while no session yet
  const [authNotice, setAuthNotice] = useState(null); // "confirm your email" hand-off from Sign Up
  const [prefsStage, setPrefsStage] = useState(false); // onboarding overlay after first signup
  const [toast, setToast] = useState(null);
  const [coords, setCoords] = useState(FALLBACK_CENTER);
  const push = view => setStack(s => [...s, view]);
  const pop = () => setStack(s => s.slice(0, -1));
  const showToast = (text, kind = 'ok', detail) => setToast({ text, kind, detail });

  useEffect(() => {  // LIVE touring GPS (Review Focus #1)
    if (!('geolocation' in navigator)) return;
    const OPTS = { enableHighAccuracy: true, timeout: 8000, maximumAge: 5000 };
    const onOk = pos => setCoords({ lng: pos.coords.longitude, lat: pos.coords.latitude });
    let id = navigator.geolocation.watchPosition(onOk, () => {}, OPTS); // errors keep Pangasinan fallback
    const onHide = () => {  // battery: no GPS while backgrounded
      navigator.geolocation.clearWatch(id);
      if (!document.hidden) id = navigator.geolocation.watchPosition(onOk, () => {}, OPTS);
    };
    document.addEventListener('visibilitychange', onHide);
    return () => { navigator.geolocation.clearWatch(id); document.removeEventListener('visibilitychange', onHide); };
  }, []);

  // first real session → preferences onboarding once (unless already filled locally)
  useEffect(() => {
    if (user && !prefsStage && !localStorage.getItem('lakbai.prefsSeen') && readLocalPrefs().length === 0) setPrefsStage(true);
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return null;

  const prefsOnce = checked => (
    <Preferences onContinue={p => { localStorage.setItem('lakbai.prefsSeen', '1'); setPrefsStage(false); checked && checked(); }}/>
  );

  if (!user){
    if (prefsStage) return prefsOnce(() => setStack([]));
    if (authStage === 'signup') return <SignUp onAuthed={(stage, detail) => {
      // Supabase needs the signup email confirmed before the first login. Send
      // the traveler to Log In with the reason instead of dropping them back on
      // the intro with no explanation.
      if (stage === 'confirm') { setAuthNotice(detail || 'Check your email to confirm your account, then log in.'); setAuthStage('login'); return; }
      setAuthStage(null);
    }} onSwitchToLogin={() => setAuthStage('login')} />;
    if (authStage === 'login') return <LogIn notice={authNotice} onAuthed={() => { setAuthNotice(null); setAuthStage(null); }} onSwitchToSignup={() => setAuthStage('signup')} />;
    return <Splash onGetStarted={() => setAuthStage('signup')} onLogIn={() => setAuthStage('login')} />;
  }
  if (prefsStage) return prefsOnce(() => setStack([]));

  const top = stack[stack.length - 1];
  const screenProps = { coords, push, pop, showToast, setTab, user, signOut };
  let body;
  if (top?.name === 'search') body = <SearchResults query={top.query} {...screenProps}/>;
  else if (top?.name === 'browse') body = <Browse kind={top.kind} {...screenProps}/>;
  else if (top?.name === 'events') body = <Events {...screenProps}/>;
  else if (top?.name === 'detail') body = <PlaceDetail place={top.place} {...screenProps}/>;
  else if (top?.name === 'emergency') body = <Emergency {...screenProps}/>;
  else if (top?.name === 'prefs-edit') body = <Preferences onBack={pop} onContinue={() => setStack([])}/>;
  else if (top?.name === 'profileEdit') body = <ProfileEdit {...screenProps}/>;
  else if (top?.name === 'itineraries') body = <Itineraries {...screenProps}/>;
  else if (top?.name === 'myReviews') body = <MyReviews {...screenProps}/>;
  else if (top?.name === 'itinerary') body = <ItineraryView plan={top.plan} {...screenProps}/>;
  else if (tab === 'home') body = <HomeTab {...screenProps}/>;
  else if (tab === 'map') body = <MapTab {...screenProps}/>;
  else if (tab === 'chat') body = <ChatTab {...screenProps}/>;
  else if (tab === 'saved') body = <SavedTab {...screenProps}/>;
  else body = <ProfileTab {...screenProps}/>;

  return (
    <div data-testid="app" style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>
      <Toast toast={toast} onClose={() => setToast(null)} />
      {body}
      {!stack.length && <TabBar tab={tab} onTab={t => { setStack([]); setTab(t); }} />}
    </div>
  );
}
