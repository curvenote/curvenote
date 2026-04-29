import { useNavigate } from 'react-router';
import { Card } from '../../components/primitives/Card.js';
import checksIllustration from './checks-illustration.svg';

export function AutomatedChecksTaskCard() {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate('/app/works/new');
  };

  return (
    <Card
      lift
      className="relative p-0 h-full bg-white transition-colors cursor-pointer border-stone-400 hover:bg-accent/50"
    >
      <button
        type="button"
        onClick={handleClick}
        className="px-2 py-4 w-full h-full cursor-pointer"
      >
        <div className="flex gap-2 items-center mx-2 h-full">
          <div className="flex flex-shrink-0 justify-center items-center w-20 h-20">
            <img
              src={checksIllustration}
              alt=""
              className="max-h-[4.5rem] w-auto object-contain"
              width={62}
              height={73}
            />
          </div>
          <div className="flex-1 text-left">
            <h3 className="text-lg font-normal">Check My Work</h3>
            <p className="text-sm text-muted-foreground">
              Upload a draft and get automatic checks on its structure, text and figures.
            </p>
          </div>
        </div>
      </button>
    </Card>
  );
}
