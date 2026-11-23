import { render, screen } from '@testing-library/react-native';
import { WorkCover } from '@/features/manuscripts/work-cover';

test('large covers show the full title and small covers keep the initial', async () => {
 await render(<WorkCover title="The Long Story" size={100} />);
 expect(screen.getByText('The Long Story', { includeHiddenElements: true })).toBeOnTheScreen();
 await render(<WorkCover title="Another Story" size={50} />);
 expect(screen.getByText('A', { includeHiddenElements: true })).toBeOnTheScreen();
});
