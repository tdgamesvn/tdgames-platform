// apps/tax-portal/components/TaxPortalEmployeeTab.tsx
// Tra cứu thông tin nhân sự phục vụ khai BHXH — đọc từ hr_employees_tax_view (không có lương/STK).
import React, { useEffect, useState } from 'react';
import { fetchTaxEmployees, TaxEmployee } from '../services/taxPortalService';

const d = (s: string | null) => (s ? new Date(s).toLocaleDateString('vi-VN') : '—');

const Field: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div>
    <div className="text-[10px] font-black text-neutral-600 uppercase tracking-wider">{label}</div>
    <div className="text-sm text-white mt-0.5">{value || '—'}</div>
  </div>
);

const TaxPortalEmployeeTab: React.FC = () => {
  const [employees, setEmployees] = useState<TaxEmployee[]>([]);
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => { fetchTaxEmployees().then(setEmployees); }, []);

  const q = search.toLowerCase();
  const filtered = employees.filter(e =>
    !q ||
    e.full_name.toLowerCase().includes(q) ||
    (e.employee_code || '').toLowerCase().includes(q) ||
    (e.id_number || '').includes(q) ||
    (e.insurance_number || '').includes(q) ||
    (e.tax_code || '').includes(q)
  );

  return (
    <div>
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Tìm theo tên, mã NV, CCCD, mã BHXH, MST..."
        className="bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white w-full md:w-96 mb-3"
      />
      <div className="bg-surface border border-primary/10 rounded-[20px] overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-neutral-600 uppercase text-[10px] font-black border-b border-white/10">
              <th className="p-3">Mã NV</th>
              <th className="p-3">Họ tên</th>
              <th className="p-3">Ngày sinh</th>
              <th className="p-3">CCCD</th>
              <th className="p-3">Mã BHXH</th>
              <th className="p-3">MST cá nhân</th>
              <th className="p-3">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(e => (
              <React.Fragment key={e.id}>
                <tr
                  className="border-b border-white/5 cursor-pointer hover:bg-white/5"
                  onClick={() => setOpenId(openId === e.id ? null : e.id)}
                >
                  <td className="p-3 text-neutral-medium">{e.employee_code || '—'}</td>
                  <td className="p-3 text-white font-bold">{e.full_name}</td>
                  <td className="p-3 text-neutral-medium">{d(e.date_of_birth)}</td>
                  <td className="p-3 text-neutral-medium">{e.id_number || '—'}</td>
                  <td className="p-3 text-neutral-medium">{e.insurance_number || '—'}</td>
                  <td className="p-3 text-neutral-medium">{e.tax_code || '—'}</td>
                  <td className="p-3">
                    <span className={`text-[10px] font-black uppercase ${e.status === 'active' ? 'text-green-400' : 'text-neutral-500'}`}>
                      {e.status === 'active' ? 'Đang làm' : e.status || '—'}
                    </span>
                  </td>
                </tr>
                {openId === e.id && (
                  <tr className="border-b border-white/5 bg-black/30">
                    <td colSpan={7} className="p-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Field label="Giới tính" value={e.gender === 'male' ? 'Nam' : e.gender === 'female' ? 'Nữ' : e.gender} />
                        <Field label="Ngày cấp CCCD" value={d(e.id_issue_date)} />
                        <Field label="Nơi cấp CCCD" value={e.id_issue_place} />
                        <Field label="Chức vụ" value={e.position} />
                        <Field label="Ngày vào làm" value={d(e.start_date)} />
                        <Field label="Ngày chính thức" value={d(e.official_date)} />
                        <Field label="Địa chỉ" value={e.address} />
                      </div>
                      {(e.id_card_front_url || e.id_card_back_url) && (
                        <div className="flex gap-4 mt-4">
                          {[['Mặt trước', e.id_card_front_url], ['Mặt sau', e.id_card_back_url]].map(([label, url]) => url && (
                            <a key={label} href={url as string} target="_blank" rel="noreferrer" className="block">
                              <div className="text-[10px] font-black text-neutral-600 uppercase tracking-wider mb-1">CCCD {label}</div>
                              <img src={url as string} alt={`CCCD ${label}`} className="h-32 rounded-lg border border-white/10 object-cover" />
                            </a>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
            {!filtered.length && (
              <tr><td colSpan={7} className="p-6 text-center text-neutral-600">Không có nhân sự nào</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TaxPortalEmployeeTab;
