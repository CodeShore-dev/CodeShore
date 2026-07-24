import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RegionSalarySummary } from './RegionSalarySummary';

describe('RegionSalarySummary', () => {
  it('月薪／年薪皆正確渲染職缺數與格式化後的代表薪資', () => {
    render(
      <RegionSalarySummary
        month={{ jobCount: 120, avgSalary: 55000 }}
        year={{ jobCount: 45, avgSalary: 1200000 }}
      />,
    );

    expect(screen.getByText('月薪')).toBeInTheDocument();
    expect(screen.getByText('年薪')).toBeInTheDocument();
    expect(screen.getByText('120')).toBeInTheDocument();
    expect(screen.getByText('45')).toBeInTheDocument();
    // toWan(55000) => '5.5萬'; toWan(1200000) => '120萬'
    expect(screen.getByText('5.5萬')).toBeInTheDocument();
    expect(screen.getByText('120萬')).toBeInTheDocument();
  });

  it('avgSalary 為 null 時顯示「—」而非 0 或空白', () => {
    render(
      <RegionSalarySummary
        month={{ jobCount: 0, avgSalary: null }}
        year={{ jobCount: 10, avgSalary: null }}
      />,
    );

    const dashes = screen.getAllByText('—');
    expect(dashes).toHaveLength(2);
    expect(screen.queryByText('0萬')).not.toBeInTheDocument();
    expect(screen.queryByText('NaN')).not.toBeInTheDocument();
  });

  it('雙方皆有資料時，兩區塊並列呈現各自的職缺數與薪資', () => {
    render(
      <RegionSalarySummary
        month={{ jobCount: 8, avgSalary: null }}
        year={{ jobCount: 3, avgSalary: 900000 }}
      />,
    );

    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('90萬')).toBeInTheDocument();
  });
});
