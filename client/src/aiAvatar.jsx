import Logo from './logo.jsx';

/**
 * The face of the assistant. The product mark belongs here — a generic compass
 * icon made LakbAI look like every other map app.
 *
 * The circle stays white: the mark is deep blue, so a blue bubble swallowed it
 * and left only the white stem showing.
 */
export default function AiAvatar(){
  return (
    <span className="ai-avatar" aria-hidden="true">
      <Logo size={17}/>
    </span>
  );
}