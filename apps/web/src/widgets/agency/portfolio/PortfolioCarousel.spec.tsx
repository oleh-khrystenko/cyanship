import {
    createEvent,
    fireEvent,
    render,
    screen,
} from '@testing-library/react';

import PortfolioCarousel from './PortfolioCarousel';
import { PORTFOLIO_ITEMS } from './cases';

const autoScroll = {
    play: jest.fn(),
    stop: jest.fn(),
    isPlaying: jest.fn(() => false),
};

const emblaApi = {
    plugins: () => ({ autoScroll }),
    on: jest.fn(),
    off: jest.fn(),
    scrollPrev: jest.fn(),
    scrollNext: jest.fn(),
};

jest.mock('embla-carousel-react', () => ({
    __esModule: true,
    default: () => [jest.fn(), emblaApi],
}));

jest.mock('embla-carousel-auto-scroll', () => ({
    __esModule: true,
    default: () => ({ name: 'autoScroll' }),
}));

jest.mock('embla-carousel-wheel-gestures', () => ({
    WheelGesturesPlugin: () => ({ name: 'wheelGestures' }),
}));

jest.mock('next-intl', () => ({
    useTranslations: () => (key: string) => key,
}));

const mockReducedMotion = (matches: boolean) => {
    window.matchMedia = jest.fn().mockReturnValue({
        matches,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
    });
};

describe('PortfolioCarousel', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockReducedMotion(false);
        window.ResizeObserver = jest.fn().mockImplementation(() => ({
            observe: jest.fn(),
            disconnect: jest.fn(),
        }));
    });

    it('renders every case in entity order', () => {
        render(<PortfolioCarousel />);

        const headings = screen.getAllByRole('heading', { level: 3 });

        expect(headings).toHaveLength(PORTFOLIO_ITEMS.length);
        expect(headings.map((node) => node.textContent)).toEqual(
            PORTFOLIO_ITEMS.map((item) => `cases.${item.slug}.title`)
        );
    });

    it('starts crawling once mounted', () => {
        render(<PortfolioCarousel />);

        expect(autoScroll.play).toHaveBeenCalled();
        expect(autoScroll.stop).not.toHaveBeenCalled();
    });

    it('stays still when the viewer asked for reduced motion, and hands over control', () => {
        mockReducedMotion(true);

        render(<PortfolioCarousel />);

        expect(autoScroll.play).not.toHaveBeenCalled();
        expect(autoScroll.stop).toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: 'resume' }));

        expect(autoScroll.play).toHaveBeenCalled();
    });

    it('stops on the pause button', () => {
        render(<PortfolioCarousel />);
        autoScroll.stop.mockClear();

        fireEvent.click(screen.getByRole('button', { name: 'pause' }));

        expect(autoScroll.stop).toHaveBeenCalled();
    });

    it('steps with the arrow keys while the strip holds focus', () => {
        render(<PortfolioCarousel />);

        fireEvent.keyDown(screen.getByRole('region', { name: 'reel_label' }), {
            key: 'ArrowRight',
        });

        expect(emblaApi.scrollNext).toHaveBeenCalled();
    });

    it('leaves the arrow keys to whatever inside the strip was pressed', () => {
        render(<PortfolioCarousel />);

        // The before/after handle moves on the same two keys, so a press that
        // started on a control inside the strip must reach that control instead
        // of scrolling.
        const [card] = screen.getAllByRole('button', { name: /^open: / });
        const event = createEvent.keyDown(card, {
            key: 'ArrowRight',
            bubbles: true,
        });
        fireEvent(card, event);

        expect(emblaApi.scrollNext).not.toHaveBeenCalled();
        expect(event.defaultPrevented).toBe(false);
    });
});
