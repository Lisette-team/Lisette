import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ExcerptFrame } from '@/features/sharing/rich-text';
import { PageShareCover } from '@/features/sharing/share-reader';

jest.mock('@/features/manuscripts/book-reader', () => ({ BookReader: () => null }));
jest.mock('@/lib/supabase', () => ({ supabase: {} }));

test('every shared card has the logo frame: two corner stars and the double gold rule', async () => {
 await render(<ExcerptFrame title="Iarna"><Text>Fragment</Text></ExcerptFrame>);
 expect(screen.getAllByTestId('frame-star', { includeHiddenElements: true })).toHaveLength(2);
 expect(screen.getByTestId('frame-rule', { includeHiddenElements: true })).toBeOnTheScreen();
 await render(<ExcerptFrame title="Iarna" synopsis><Text>Rezumat</Text></ExcerptFrame>);
 expect(screen.getAllByTestId('frame-star', { includeHiddenElements: true })).toHaveLength(2);
 expect(screen.getByTestId('frame-rule', { includeHiddenElements: true })).toBeOnTheScreen();
 await render(<PageShareCover title="Iarna" pageStart={3} pageEnd={7} />);
 expect(screen.getAllByTestId('frame-star', { includeHiddenElements: true })).toHaveLength(2);
 expect(screen.getByTestId('frame-rule', { includeHiddenElements: true })).toBeOnTheScreen();
});
