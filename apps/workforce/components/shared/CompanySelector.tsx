import React from 'react';

export type CompanyId = 'tdgames' | 'tdconsulting';

export const COMPANY_CONFIG: Record<CompanyId, {
  name: string; logo: string; subtitle: string;
  fullName: string; address: string; taxCode: string;
  representative: string; representativeTitle: string; gender: string;
}> = {
  tdgames: {
    name: 'TD Games Studio', logo: '/logo_td_notext.png', subtitle: 'CÔNG TY TNHH TD GAMES',
    fullName: 'Công ty TNHH TD Games', address: 'Xóm Ngoài, Xã Đông Anh, TP Hà Nội',
    taxCode: '0111386856', representative: 'Đặng Thế Toàn', representativeTitle: 'Tổng Giám Đốc', gender: 'Ông',
  },
  tdconsulting: {
    name: 'TD Consulting', logo: '/logo_tdc.png', subtitle: 'CÔNG TY TNHH TD CONSULTING',
    fullName: 'Công ty TNHH TD Consulting', address: 'Xóm Ngoài, Xã Đông Anh, TP Hà Nội',
    taxCode: '0109898663', representative: 'Nguyễn Thị Thùy Dung', representativeTitle: 'Tổng Giám Đốc', gender: 'Bà',
  },
};

interface CompanySelectorProps {
  selected: CompanyId;
  onChange: (id: CompanyId) => void;
}

export const CompanySelector: React.FC<CompanySelectorProps> = ({ selected, onChange }) => (
  <div className="flex items-center rounded-xl border border-primary/10 overflow-hidden">
    <button
      onClick={() => onChange('tdgames')}
      className={`px-4 py-2.5 text-xs font-bold tracking-wider transition-all flex items-center gap-2 ${
        selected === 'tdgames'
          ? 'bg-primary/20 text-primary border-r border-primary/20'
          : 'text-neutral-medium hover:text-white hover:bg-white/5 border-r border-primary/10'
      }`}
    >
      <img src="/logo_td_notext.png" alt="" className="w-5 h-5 object-contain" />
      TD Games
    </button>
    {/* ponytail: TD Consulting là LEGACY — chỉ hiện khi chứng từ CŨ đang gắn pháp nhân đó,
        để xuất lại đúng bản gốc. Chứng từ mới chỉ ký TD Games nên nút này không xuất hiện. */}
    {selected === 'tdconsulting' && (
      <button
        disabled
        title="Pháp nhân cũ — giữ để xuất lại chứng từ đã lập trước đây"
        className="px-4 py-2.5 text-xs font-bold tracking-wider flex items-center gap-2 bg-pink-500/20 text-pink-400 cursor-default"
      >
        <img src="/logo_tdc.png" alt="" className="w-5 h-5 object-contain" />
        TD Consulting
      </button>
    )}
  </div>
);
