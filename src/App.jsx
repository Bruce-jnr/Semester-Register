import { useEffect, useState } from 'react';
import { api, post, download } from './api';

const levels = ['Level 100', 'Level 200', 'Level 300', 'Level 400'];
const genders = ['Male', 'Female'];
const isLevel100 = (level) => /^(?:level\s*)?100$/i.test(String(level).trim());
const uniformLabel = (student) =>
  isLevel100(student.level)
    ? student.uniform_fee_status || 'Not recorded'
    : 'Not applicable';
const money = (value) =>
  new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(
    Number(value || 0),
  );

function Form({
  title,
  fields,
  onSubmit,
  submit = 'Save',
  initial = {},
  conditionalFields = () => [],
}) {
  const [values, setValues] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  async function save(event) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setMessage(null);
    try {
      await onSubmit(Object.fromEntries(new FormData(form)));
      setMessage({ text: 'Saved successfully.', kind: 'success' });
      form.reset();
      setValues(initial);
    } catch (error) {
      setMessage({ text: error.message, kind: 'error' });
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <h2>{title}</h2>
      <form
        onSubmit={save}
        onChange={(event) =>
          setValues((previous) => ({
            ...previous,
            [event.target.name]: event.target.value,
          }))
        }
      >
        <div className="form-grid">
          {[...fields, ...conditionalFields(values)].map(
            ([name, label, options]) => (
              <label key={name}>
                {label}
                {Array.isArray(options) ? (
                  <select
                    name={name}
                    required
                    defaultValue={initial[name] || ''}
                  >
                    <option value="">Select {label.toLowerCase()}</option>
                    {options.map((option) => (
                      <option
                        key={typeof option === 'string' ? option : option.id}
                        value={typeof option === 'string' ? option : option.id}
                      >
                        {typeof option === 'string' ? option : option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    name={name}
                    type={options || 'text'}
                    required={
                      !['program', 'email', 'currentPassword'].includes(name)
                    }
                    defaultValue={initial[name] ?? ''}
                    min={options === 'number' ? 1 : undefined}
                    step={name === 'amount_paid' ? '0.01' : undefined}
                    autoComplete={
                      options === 'password' ? 'new-password' : undefined
                    }
                  />
                )}
              </label>
            ),
          )}
        </div>
        {message && (
          <p role="status" className={`notice ${message.kind}`}>
            {message.text}
          </p>
        )}
        <button disabled={busy}>{busy ? 'Saving…' : submit}</button>
      </form>
    </section>
  );
}

function Login({ onLogin }) {
  return (
    <main className="login">
      <div className="login-intro">
        <img src="/images/logo.jpg" alt="College crest" />
        <p className="eyebrow">STUDENT SERVICES</p>
        <h1>
          A better start
          <br />
          to the semester.
        </h1>
        <p>Registration, accommodation and payments in one place.</p>
      </div>
      <Form
        title="Welcome back"
        submit="Sign in"
        fields={[
          ['username', 'Username'],
          ['password', 'Password', 'password'],
        ]}
        onSubmit={async (values) => {
          await post('/auth/login', values);
          onLogin((await api('/auth/me')).user);
        }}
      />
    </main>
  );
}

function Students({ user, refresh, onChange }) {
  const fixedGender =
    user.role === 'Male Host Awardee'
      ? 'Male'
      : user.role === 'Female Host Awardee'
        ? 'Female'
        : '';
  const [filters, setFilters] = useState({
    gender: fixedGender,
    level: '',
    search: '',
  });
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [roomId, setRoomId] = useState('');
  const [uniformUpdating, setUniformUpdating] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const query = new URLSearchParams({ ...filters, page, limit: 50 }).toString();
  useEffect(() => {
    let active = true;
    api(`/students?${query}`)
      .then((data) => {
        if (active) {
          setResult(data);
          setError('');
          setLoading(false);
        }
      })
      .catch((e) => {
        if (active) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [query, refresh]);
  function filter(name, value) {
    setLoading(true);
    setFilters((previous) => ({ ...previous, [name]: value }));
    setPage(1);
  }
  async function choose(student) {
    setError('');
    try {
      const data = await api('/rooms');
      setRooms(
        data.rooms.filter(
          (room) =>
            room.gender_type === student.gender &&
            (room.current_capacity > 0 || room.id === student.room_id),
        ),
      );
      setRoomId(
        student.is_non_residential
          ? 'non-residential'
          : student.room_id
            ? String(student.room_id)
            : '',
      );
      setSelected(student);
    } catch (e) {
      setError(e.message);
    }
  }
  async function updateUniform(student, status) {
    setUniformUpdating(student.id);
    setError('');
    try {
      await api(`/students/${student.id}/uniform-fee`, {
        method: 'PATCH',
        body: JSON.stringify({ uniform_fee_status: status }),
      });
      setResult((previous) => ({
        ...previous,
        students: previous.students.map((item) =>
          item.id === student.id
            ? { ...item, uniform_fee_status: status }
            : item,
        ),
      }));
      onChange();
    } catch (error) {
      setError(error.message);
    } finally {
      setUniformUpdating(null);
    }
  }
  async function allocate(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await post('/students/allocate', { studentId: selected.id, roomId });
      setSelected(null);
      onChange();
      setLoading(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <h2>Student directory</h2>
          <p>Find students and track their accommodation.</p>
        </div>
        {user.role !== 'Matron' && (
          <button
            className="secondary"
            onClick={() =>
              download(
                fixedGender
                  ? `/students/gender/${fixedGender}/export?${query}`
                  : `/students/export?${query}`,
              ).catch((e) => setError(e.message))
            }
          >
            Export Excel
          </button>
        )}
      </div>
      <div className="filters">
        <input
          aria-label="Search students"
          placeholder="Search name, index number or phone…"
          value={filters.search}
          onChange={(e) => filter('search', e.target.value)}
        />
        {!fixedGender && (
          <select
            aria-label="Gender"
            value={filters.gender}
            onChange={(e) => filter('gender', e.target.value)}
          >
            <option value="">All genders</option>
            {genders.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
        )}
        <input
          aria-label="Level"
          placeholder="Filter by level"
          value={filters.level}
          onChange={(e) => filter('level', e.target.value)}
        />
      </div>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {selected && (
        <form className="allocation" onSubmit={allocate}>
          <strong>Accommodation for {selected.name}</strong>
          <select
            aria-label="Accommodation option"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            required
          >
            <option value="">Choose accommodation</option>
            <option value="non-residential">
              Non-residential (no room required)
            </option>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.room_number} ·{' '}
                {room.id === selected.room_id
                  ? 'Current room'
                  : `${room.current_capacity} spaces available`}
              </option>
            ))}
          </select>
          <button
            disabled={
              busy ||
              !roomId ||
              roomId ===
                (selected.is_non_residential
                  ? 'non-residential'
                  : String(selected.room_id || ''))
            }
          >
            {busy ? 'Saving…' : 'Save accommodation'}
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => setSelected(null)}
          >
            Cancel
          </button>
        </form>
      )}
      {loading ? (
        <p role="status">Loading students…</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Index number</th>
                <th>Gender / Level</th>
                <th>Phone</th>
                <th>Uniform fee</th>
                <th>Accommodation</th>
                {user.role === 'Registra' && <th>Action</th>}
              </tr>
            </thead>
            <tbody>
              {result?.students.map((student) => (
                <tr key={student.id}>
                  <td>
                    <strong>{student.name}</strong>
                    <small>{student.program || '—'}</small>
                  </td>
                  <td>{student.index_number}</td>
                  <td>
                    {student.gender}
                    <small>{student.level}</small>
                  </td>
                  <td>{student.phone}</td>
                  <td>
                    {user.role === 'Registra' && isLevel100(student.level) ? (
                      <>
                        <select
                          aria-label={`Uniform fee for ${student.name}`}
                          value={student.uniform_fee_status || ''}
                          disabled={uniformUpdating !== null}
                          onChange={(event) =>
                            updateUniform(student, event.target.value)
                          }
                        >
                          <option value="" disabled>
                            Not recorded
                          </option>
                          <option value="Paid">Paid</option>
                          <option value="Unpaid">Unpaid</option>
                        </select>
                        {uniformUpdating === student.id && (
                          <small role="status">Saving…</small>
                        )}
                      </>
                    ) : (
                      uniformLabel(student)
                    )}
                  </td>
                  <td>
                    <span
                      className={`badge ${student.is_non_residential ? 'non-residential' : student.room_id ? 'assigned' : ''}`}
                    >
                      {student.is_non_residential
                        ? 'Non-residential'
                        : student.room_number || 'Awaiting a room'}
                    </span>
                  </td>
                  {user.role === 'Registra' && (
                    <td>
                      <button
                        className="secondary compact"
                        onClick={() => choose(student)}
                      >
                        {student.room_id
                          ? 'Change room'
                          : student.is_non_residential
                            ? 'Change accommodation'
                            : 'Set accommodation'}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {!result?.students.length && (
            <p className="empty">No students match these filters.</p>
          )}
        </div>
      )}
      <Pager
        pagination={result?.pagination}
        page={page}
        setPage={(value) => {
          setLoading(true);
          setPage(value);
        }}
      />
    </section>
  );
}

function Pager({ pagination, page, setPage }) {
  if (!pagination) return null;
  return (
    <div className="pager">
      <span>
        {pagination.total} records · Page {page} of{' '}
        {Math.max(1, pagination.totalPages)}
      </span>
      <div>
        <button
          className="secondary"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
        >
          Previous
        </button>
        <button
          className="secondary"
          disabled={page >= pagination.totalPages}
          onClick={() => setPage(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}

function Rooms({ refresh, onChange }) {
  const [rooms, setRooms] = useState([]);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    api('/rooms')
      .then((data) => {
        if (active) setRooms(data.rooms);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [refresh]);
  const fields = [
    ['room_number', 'Room number'],
    ['gender_type', 'Gender', genders],
    ['capacity', 'Total capacity', 'number'],
  ];
  return (
    <>
      <Form
        key={editing?.id || 'new'}
        title={editing ? `Edit room ${editing.room_number}` : 'Add a room'}
        fields={fields}
        initial={editing || {}}
        onSubmit={async (values) => {
          await api(editing ? `/rooms/${editing.id}` : '/rooms', {
            method: editing ? 'PUT' : 'POST',
            body: JSON.stringify(values),
          });
          setEditing(null);
          onChange();
        }}
      />
      {editing && (
        <button className="secondary" onClick={() => setEditing(null)}>
          Cancel edit
        </button>
      )}
      {error && <p className="notice error">{error}</p>}
      <div className="room-grid">
        {rooms.map((room) => (
          <section className="panel" key={room.id}>
            <span className="eyebrow">{room.gender_type} HOSTEL</span>
            <h2>{room.room_number}</h2>
            <p>
              {room.current_capacity} of {room.capacity} spaces available
            </p>
            <progress
              value={room.capacity - room.current_capacity}
              max={room.capacity}
              aria-label="Occupied beds"
            />
            <div className="actions">
              <button className="secondary" onClick={() => setEditing(room)}>
                Edit
              </button>
              <button
                className="danger"
                onClick={async () => {
                  if (!window.confirm(`Delete room ${room.room_number}?`))
                    return;
                  try {
                    await api(`/rooms/${room.id}`, { method: 'DELETE' });
                    onChange();
                  } catch (e) {
                    setError(e.message);
                  }
                }}
              >
                Delete
              </button>
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

function Fees({ user, refresh, onChange }) {
  const [filters, setFilters] = useState({
    level: '',
    receipt_issued: '',
    payment_method: '',
    search: '',
  });
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const query = new URLSearchParams({ ...filters, page, limit: 50 }).toString();
  useEffect(() => {
    let active = true;
    api(`/fees?${query}`)
      .then((data) => {
        if (active) setResult(data);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [query, refresh]);
  const fields = [
    ['index_number', 'Index number'],
    ['student_name', 'Student name'],
    ['level', 'Level', levels],
    ['amount_paid', 'Amount paid (GHS)', 'number'],
    ['payment_method', 'Payment method', ['GCB', 'CBG', 'CBG USSD']],
    ['date_paid', 'Payment date', 'date'],
    ['receipt_number', 'Bank receipt number'],
  ];
  function filter(name, value) {
    setFilters((previous) => ({ ...previous, [name]: value }));
    setPage(1);
  }
  return (
    <>
      <Form
        title="Record a payment"
        fields={fields}
        onSubmit={async (values) => {
          await post('/fees', values);
          onChange();
        }}
      />
      <section className="panel">
        <div className="section-heading">
          <h2>Payment records</h2>
          {user.role === 'Accountant' && (
            <button
              className="secondary"
              onClick={() =>
                download(`/fees/export?${query}`).catch((e) =>
                  setError(e.message),
                )
              }
            >
              Export Excel
            </button>
          )}
        </div>
        <div className="filters">
          <input
            aria-label="Search payments"
            placeholder="Search student or receipt…"
            value={filters.search}
            onChange={(e) => filter('search', e.target.value)}
          />
          <input
            aria-label="Payment level"
            placeholder="Filter by level"
            value={filters.level}
            onChange={(e) => filter('level', e.target.value)}
          />
          <select
            aria-label="Receipt status"
            value={filters.receipt_issued}
            onChange={(e) => filter('receipt_issued', e.target.value)}
          >
            <option value="">All receipts</option>
            <option value="true">Issued</option>
            <option value="false">Pending</option>
          </select>
          <select
            aria-label="Payment method"
            value={filters.payment_method}
            onChange={(e) => filter('payment_method', e.target.value)}
          >
            <option value="">All methods</option>
            {['GCB', 'CBG', 'CBG USSD'].map((method) => (
              <option key={method}>{method}</option>
            ))}
          </select>
        </div>
        {error && <p className="notice error">{error}</p>}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Amount</th>
                <th>Method / Date</th>
                <th>Bank receipt</th>
                <th>College receipt</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {result?.fees.map((fee) => (
                <tr key={fee.id}>
                  <td>
                    <strong>{fee.student_name}</strong>
                    <small>
                      {fee.index_number} · {fee.level}
                    </small>
                  </td>
                  <td>{money(fee.amount_paid)}</td>
                  <td>
                    {fee.payment_method}
                    <small>
                      {new Date(fee.date_paid).toLocaleDateString()}
                    </small>
                  </td>
                  <td>{fee.receipt_number}</td>
                  <td>{fee.college_receipt_number || '—'}</td>
                  <td>
                    {user.role === 'Accountant' ? (
                      <a
                        className="button secondary"
                        target="_blank"
                        rel="noreferrer"
                        href={`/api/fees/receipt/${fee.id}`}
                        onClick={() => setTimeout(onChange, 1500)}
                      >
                        {fee.receipt_issued ? 'Reprint' : 'Issue receipt'}
                      </a>
                    ) : fee.receipt_issued ? (
                      'Issued'
                    ) : (
                      'Pending'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {result && !result.fees.length && (
            <p className="empty">No payments match these filters.</p>
          )}
        </div>
        <Pager pagination={result?.pagination} page={page} setPage={setPage} />
      </section>
    </>
  );
}

function Admins({ user }) {
  const [admins, setAdmins] = useState([]);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    api('/auth/admins')
      .then((data) => {
        if (active) setAdmins(data.admins);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <>
      {error && <p className="notice error">{error}</p>}
      <Form
        title="Reset administrator password"
        fields={[
          [
            'adminId',
            'Administrator',
            admins.map((admin) => ({
              id: admin.id,
              label: `${admin.username} · ${admin.role}${admin.id === user.id ? ' (you)' : ''}`,
            })),
          ],
          ['newPassword', 'New password', 'password'],
          [
            'currentPassword',
            'Current password (required for your own account)',
            'password',
          ],
        ]}
        onSubmit={(values) => post('/auth/reset-password', values)}
      />
    </>
  );
}

function Workspace({ user, onLogout }) {
  const tabs =
    user.role === 'Registra'
      ? [
          'Overview',
          'Students',
          'Register',
          'Rooms',
          'Payments',
          'Administrators',
        ]
      : user.role === 'Accountant'
        ? ['Overview', 'Payments']
        : ['Overview', 'Students'];
  const [tab, setTab] = useState(tabs[0]);
  const [refresh, setRefresh] = useState(0);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const gender =
    user.role === 'Male Host Awardee'
      ? 'Male'
      : user.role === 'Female Host Awardee'
        ? 'Female'
        : '';
  useEffect(() => {
    let active = true;
    api(
      user.role === 'Accountant'
        ? '/fees/stats'
        : `/students/stats?gender=${gender}`,
    )
      .then((data) => {
        if (active) setStats(data.stats);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [refresh, user.role, gender]);
  const onChange = () => setRefresh((value) => value + 1);
  const cards =
    user.role === 'Accountant'
      ? [
          ['Payments', stats?.totalPayments],
          ['Collected', money(stats?.totalAmount)],
          ['Receipts issued', stats?.receiptIssued],
          ['Receipts pending', stats?.receiptPending],
        ]
      : [
          ['Registered students', stats?.total],
          ['Allocated', stats?.allocated],
          ['Awaiting a room', stats?.unallocated],
          ['Non-residential', stats?.nonResidential],
        ];
  return (
    <div className="layout">
      <aside>
        <a className="brand" href="/">
          <img src="/images/logo.jpg" alt="College crest" />
          <span>
            Registra<small>STUDENT SERVICES</small>
          </span>
        </a>
        <p className="nav-label">MENU</p>
        <nav>
          {tabs.map((item) => (
            <button
              key={item}
              className={tab === item ? 'active' : ''}
              onClick={() => setTab(item)}
            >
              {item}
            </button>
          ))}
        </nav>
        <div className="account">
          <strong>{user.username}</strong>
          <small>{user.role}</small>
          <button
            className="secondary"
            onClick={async () => {
              try {
                await post('/auth/logout', {});
                onLogout();
              } catch (e) {
                setError(e.message);
              }
            }}
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="workspace">
        <header>
          <div>
            <p className="eyebrow">SEMESTER MANAGEMENT</p>
            <h1>{tab === 'Overview' ? `Welcome, ${user.username}` : tab}</h1>
            <p>Manage the details. Make room for a great semester.</p>
          </div>
          <span className="role">{user.role}</span>
        </header>
        {error && (
          <p role="alert" className="notice error">
            {error}
          </p>
        )}
        {tab === 'Overview' && (
          <>
            <div className="stats">
              {cards.map(([label, value]) => (
                <section className="stat" key={label}>
                  <p>{label}</p>
                  <strong>{value ?? '—'}</strong>
                </section>
              ))}
            </div>
            <section className="panel">
              <h2>Your workspace</h2>
              <p>Choose an area below to get started.</p>
              <div className="quick-links">
                {tabs.slice(1).map((item) => (
                  <button
                    className="secondary"
                    key={item}
                    onClick={() => setTab(item)}
                  >
                    {item} →
                  </button>
                ))}
              </div>
              {stats?.levelCounts?.map((item) => (
                <div className="level-row" key={item.level}>
                  <span>{item.level}</span>
                  <strong>{item.count} students</strong>
                </div>
              ))}
            </section>
          </>
        )}
        {tab === 'Students' && (
          <Students user={user} refresh={refresh} onChange={onChange} />
        )}
        {tab === 'Register' && (
          <Form
            title="Register a student"
            submit="Register student"
            conditionalFields={(values) =>
              isLevel100(values.level)
                ? [['uniform_fee_status', 'Uniform fee', ['Paid', 'Unpaid']]]
                : []
            }
            fields={[
              ['index_number', 'Index number'],
              ['name', 'Full name'],
              ['gender', 'Gender', genders],
              [
                'residence_type',
                'Residence type',
                ['Residential', 'Non-residential'],
              ],
              ['level', 'Level', levels],
              ['phone', 'Phone number', 'tel'],
            ]}
            onSubmit={async (values) => {
              await post('/students', values);
              onChange();
            }}
          />
        )}
        {tab === 'Rooms' && <Rooms refresh={refresh} onChange={onChange} />}
        {tab === 'Payments' && (
          <Fees user={user} refresh={refresh} onChange={onChange} />
        )}
        {tab === 'Administrators' && <Admins user={user} />}
      </main>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    const expired = () => setUser(null);
    window.addEventListener('session-expired', expired);
    api('/auth/me')
      .then((data) => {
        if (active) setUser(data.user);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      window.removeEventListener('session-expired', expired);
    };
  }, []);
  if (loading)
    return (
      <main className="splash" role="status">
        Opening your workspace…
      </main>
    );
  return user ? (
    <Workspace key={user.id} user={user} onLogout={() => setUser(null)} />
  ) : (
    <Login onLogin={setUser} />
  );
}
