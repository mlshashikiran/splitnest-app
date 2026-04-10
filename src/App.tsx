import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

type MemberRole = 'tenant' | 'owner'
type ExpenseCategory = 'Water' | 'Electricity' | 'Misc'

type Member = {
  id: string
  name: string
  role: MemberRole
}

type Expense = {
  id: string
  title: string
  amount: number
  paidByMemberId: string
  date: string
  category: ExpenseCategory
  splitAmongMemberIds: string[]
}

type Settlement = {
  id: string
  fromMemberId: string
  toMemberId: string
  amount: number
  date: string
}

type NoticeTone = 'success' | 'error'

type AppData = {
  houseName: string
  members: Member[]
  expenses: Expense[]
  settlements: Settlement[]
}

type Notice = {
  tone: NoticeTone
  text: string
} | null

type BalanceRow = {
  member: Member
  amount: number
  paid: number
  share: number
}

type SuggestedSettlement = {
  fromMember: Member
  toMember: Member
  amount: number
}

const STORAGE_KEY = 'splitnest:v1'
const CATEGORY_OPTIONS: ExpenseCategory[] = ['Water', 'Electricity', 'Misc']

const today = new Date().toISOString().slice(0, 10)
const currentMonth = new Date().toISOString().slice(0, 7)

function createId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function loadAppData(): AppData {
  if (typeof window === 'undefined') {
    return { houseName: '', members: [], expenses: [], settlements: [] }
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)

    if (!raw) {
      return { houseName: '', members: [], expenses: [], settlements: [] }
    }

    const parsed = JSON.parse(raw) as Partial<AppData>
    const members = Array.isArray(parsed.members) ? parsed.members : []

    return {
      houseName: typeof parsed.houseName === 'string' ? parsed.houseName : '',
      members,
      expenses: Array.isArray(parsed.expenses)
        ? parsed.expenses.map((expense) => ({
            ...expense,
            splitAmongMemberIds:
              Array.isArray(expense.splitAmongMemberIds) &&
              expense.splitAmongMemberIds.length > 0
                ? expense.splitAmongMemberIds
                : members.map((member) => member.id),
          }))
        : [],
      settlements: Array.isArray(parsed.settlements) ? parsed.settlements : [],
    }
  } catch {
    return { houseName: '', members: [], expenses: [], settlements: [] }
  }
}

function buildSampleData(): AppData {
  const members: Member[] = [
    { id: createId('member'), name: 'Asha', role: 'tenant' },
    { id: createId('member'), name: 'Rohan', role: 'tenant' },
    { id: createId('member'), name: 'Mira', role: 'tenant' },
    { id: createId('member'), name: 'Mr. Shah', role: 'owner' },
  ]

  return {
    houseName: 'Palm Grove Flat',
    members,
    expenses: [
      {
        id: createId('expense'),
        title: 'Water Tanker',
        amount: 1600,
        paidByMemberId: members[0].id,
        date: `${currentMonth}-02`,
        category: 'Water',
        splitAmongMemberIds: members.map((member) => member.id),
      },
      {
        id: createId('expense'),
        title: 'Electricity Bill',
        amount: 2450,
        paidByMemberId: members[3].id,
        date: `${currentMonth}-05`,
        category: 'Electricity',
        splitAmongMemberIds: members.map((member) => member.id),
      },
      {
        id: createId('expense'),
        title: 'Cleaning Supplies',
        amount: 780,
        paidByMemberId: members[1].id,
        date: `${currentMonth}-07`,
        category: 'Misc',
        splitAmongMemberIds: members.map((member) => member.id),
      },
    ],
    settlements: [
      {
        id: createId('settlement'),
        fromMemberId: members[2].id,
        toMemberId: members[0].id,
        amount: 400,
        date: `${currentMonth}-08`,
      },
    ],
  }
}

function calculateBalances(data: AppData): BalanceRow[] {
  const balances = new Map<string, number>()
  const paidTotals = new Map<string, number>()
  const shareTotals = new Map<string, number>()

  data.members.forEach((member) => {
    balances.set(member.id, 0)
    paidTotals.set(member.id, 0)
    shareTotals.set(member.id, 0)
  })

  data.expenses.forEach((expense) => {
    const participantIds =
      expense.splitAmongMemberIds.length > 0
        ? expense.splitAmongMemberIds
        : data.members.map((member) => member.id)
    const share = expense.amount / participantIds.length

    balances.set(
      expense.paidByMemberId,
      (balances.get(expense.paidByMemberId) ?? 0) + expense.amount,
    )
    paidTotals.set(
      expense.paidByMemberId,
      (paidTotals.get(expense.paidByMemberId) ?? 0) + expense.amount,
    )

    participantIds.forEach((participantId) => {
      balances.set(participantId, (balances.get(participantId) ?? 0) - share)
      shareTotals.set(participantId, (shareTotals.get(participantId) ?? 0) + share)
    })
  })

  data.settlements.forEach((settlement) => {
    balances.set(
      settlement.fromMemberId,
      (balances.get(settlement.fromMemberId) ?? 0) + settlement.amount,
    )
    balances.set(
      settlement.toMemberId,
      (balances.get(settlement.toMemberId) ?? 0) - settlement.amount,
    )
  })

  return data.members.map((member) => ({
    member,
    amount: balances.get(member.id) ?? 0,
    paid: paidTotals.get(member.id) ?? 0,
    share: shareTotals.get(member.id) ?? 0,
  }))
}

function calculateSuggestedSettlements(rows: BalanceRow[]): SuggestedSettlement[] {
  const creditors = rows
    .filter((row) => row.amount > 0.01)
    .map((row) => ({ ...row }))
    .sort((a, b) => b.amount - a.amount)
  const debtors = rows
    .filter((row) => row.amount < -0.01)
    .map((row) => ({ ...row, amount: Math.abs(row.amount) }))
    .sort((a, b) => b.amount - a.amount)
  const suggestions: SuggestedSettlement[] = []

  let creditorIndex = 0
  let debtorIndex = 0

  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const creditor = creditors[creditorIndex]
    const debtor = debtors[debtorIndex]
    const amount = Math.min(creditor.amount, debtor.amount)

    suggestions.push({
      fromMember: debtor.member,
      toMember: creditor.member,
      amount,
    })

    creditor.amount -= amount
    debtor.amount -= amount

    if (creditor.amount <= 0.01) {
      creditorIndex += 1
    }

    if (debtor.amount <= 0.01) {
      debtorIndex += 1
    }
  }

  return suggestions
}

function getMonthlySummary(data: AppData, month: string) {
  const monthlyExpenses = data.expenses.filter((expense) => expense.date.startsWith(month))
  const monthlySettlements = data.settlements.filter((settlement) =>
    settlement.date.startsWith(month),
  )
  const monthlyData: AppData = {
    houseName: data.houseName,
    members: data.members,
    expenses: monthlyExpenses,
    settlements: monthlySettlements,
  }
  const balances = calculateBalances(monthlyData)
  const totalExpenses = monthlyExpenses.reduce((sum, expense) => sum + expense.amount, 0)
  const categories = CATEGORY_OPTIONS.map((category) => ({
    category,
    total: monthlyExpenses
      .filter((expense) => expense.category === category)
      .reduce((sum, expense) => sum + expense.amount, 0),
  })).filter((row) => row.total > 0)

  return {
    month,
    totalExpenses,
    expensesCount: monthlyExpenses.length,
    settlementsCount: monthlySettlements.length,
    balances,
    categories,
  }
}

function App() {
  const [data, setData] = useState<AppData>(() => loadAppData())
  const [notice, setNotice] = useState<Notice>(null)

  const [setupHouseName, setSetupHouseName] = useState('')
  const [setupMemberName, setSetupMemberName] = useState('')
  const [setupMemberRole, setSetupMemberRole] = useState<MemberRole>('tenant')
  const [setupMembers, setSetupMembers] = useState<Member[]>([])

  const [memberName, setMemberName] = useState('')
  const [memberRole, setMemberRole] = useState<MemberRole>('tenant')

  const [expenseTitle, setExpenseTitle] = useState('')
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expensePaidBy, setExpensePaidBy] = useState('')
  const [expenseDate, setExpenseDate] = useState(today)
  const [expenseCategory, setExpenseCategory] = useState<ExpenseCategory>('Water')

  const [settlementFrom, setSettlementFrom] = useState('')
  const [settlementTo, setSettlementTo] = useState('')
  const [settlementAmount, setSettlementAmount] = useState('')
  const [settlementDate, setSettlementDate] = useState(today)

  const [historyMonthFilter, setHistoryMonthFilter] = useState(currentMonth)
  const [historyCategoryFilter, setHistoryCategoryFilter] = useState<'All' | ExpenseCategory>(
    'All',
  )
  const [historyMemberFilter, setHistoryMemberFilter] = useState('all')
  const [summaryMonth, setSummaryMonth] = useState(currentMonth)

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }, [data])

  useEffect(() => {
    if (!notice) {
      return undefined
    }

    const timeout = window.setTimeout(() => setNotice(null), 3000)
    return () => window.clearTimeout(timeout)
  }, [notice])

  const balances = calculateBalances(data)
  const suggestedSettlements = calculateSuggestedSettlements(balances)
  const totalExpenses = data.expenses.reduce((sum, expense) => sum + expense.amount, 0)
  const pendingAmount = balances
    .filter((row) => row.amount < -0.01)
    .reduce((sum, row) => sum + Math.abs(row.amount), 0)
  const settledAmount = data.settlements.reduce((sum, settlement) => sum + settlement.amount, 0)
  const monthlySummary = getMonthlySummary(data, summaryMonth)
  const selectedExpensePayer = expensePaidBy || data.members[0]?.id || ''
  const selectedSettlementFrom = settlementFrom || data.members[0]?.id || ''
  const selectedSettlementTo =
    settlementTo || data.members[1]?.id || data.members[0]?.id || ''

  const filteredExpenses = data.expenses
    .filter((expense) => {
      const matchesMonth = historyMonthFilter
        ? expense.date.startsWith(historyMonthFilter)
        : true
      const matchesCategory =
        historyCategoryFilter === 'All' || expense.category === historyCategoryFilter
      const matchesMember =
        historyMemberFilter === 'all' || expense.paidByMemberId === historyMemberFilter

      return matchesMonth && matchesCategory && matchesMember
    })
    .sort((left, right) => right.date.localeCompare(left.date))

  function showMessage(tone: NoticeTone, text: string) {
    setNotice({ tone, text })
  }

  function addSetupMember() {
    if (!setupMemberName.trim()) {
      showMessage('error', 'Enter a member name before adding them.')
      return
    }

    setSetupMembers((current) => [
      ...current,
      {
        id: createId('member'),
        name: setupMemberName.trim(),
        role: setupMemberRole,
      },
    ])
    setSetupMemberName('')
  }

  function createHousehold(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!setupHouseName.trim()) {
      showMessage('error', 'Choose a house name first.')
      return
    }

    if (setupMembers.length < 2) {
      showMessage('error', 'Add at least two members to start splitting expenses.')
      return
    }

    setData({
      houseName: setupHouseName.trim(),
      members: setupMembers,
      expenses: [],
      settlements: [],
    })
    showMessage('success', 'Household created. You can start logging expenses now.')
  }

  function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!memberName.trim()) {
      showMessage('error', 'Enter a member name before saving.')
      return
    }

    setData((current) => ({
      ...current,
      members: [
        ...current.members,
        {
          id: createId('member'),
          name: memberName.trim(),
          role: memberRole,
        },
      ],
    }))
    setMemberName('')
    showMessage('success', 'Member added. Future expenses will include them automatically.')
  }

  function addExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const parsedAmount = Number.parseFloat(expenseAmount)

    if (
      !expenseTitle.trim() ||
      !selectedExpensePayer ||
      Number.isNaN(parsedAmount) ||
      parsedAmount <= 0
    ) {
      showMessage('error', 'Fill in the title, payer, and a valid amount.')
      return
    }

    setData((current) => ({
      ...current,
      expenses: [
        {
          id: createId('expense'),
          title: expenseTitle.trim(),
          amount: parsedAmount,
          paidByMemberId: selectedExpensePayer,
          date: expenseDate,
          category: expenseCategory,
          splitAmongMemberIds: current.members.map((member) => member.id),
        },
        ...current.expenses,
      ],
    }))
    setExpenseTitle('')
    setExpenseAmount('')
    setExpenseCategory('Water')
    showMessage('success', 'Expense added and split equally across the household.')
  }

  function addSettlement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const parsedAmount = Number.parseFloat(settlementAmount)

    if (
      !selectedSettlementFrom ||
      !selectedSettlementTo ||
      selectedSettlementFrom === selectedSettlementTo ||
      Number.isNaN(parsedAmount) ||
      parsedAmount <= 0
    ) {
      showMessage('error', 'Choose two different members and enter a valid amount.')
      return
    }

    setData((current) => ({
      ...current,
      settlements: [
        {
          id: createId('settlement'),
          fromMemberId: selectedSettlementFrom,
          toMemberId: selectedSettlementTo,
          amount: parsedAmount,
          date: settlementDate,
        },
        ...current.settlements,
      ],
    }))
    setSettlementAmount('')
    showMessage('success', 'Settlement recorded and balances updated.')
  }

  function loadDemoData() {
    setData(buildSampleData())
    setNotice({
      tone: 'success',
      text: 'Demo household loaded so you can explore the full flow immediately.',
    })
  }

  function resetAllData() {
    if (!window.confirm('This clears the household, expenses, and settlements stored on this device.')) {
      return
    }

    const emptyState = { houseName: '', members: [], expenses: [], settlements: [] }
    setData(emptyState)
    setSetupHouseName('')
    setSetupMemberName('')
    setSetupMembers([])
    window.localStorage.removeItem(STORAGE_KEY)
    showMessage('success', 'Local data cleared.')
  }

  return (
    <div className="app-shell">
      <header className="hero-card">
        <div>
          <p className="eyebrow">SplitNest MVP</p>
          <h1>Shared house expenses without the monthly math headache.</h1>
          <p className="hero-copy">
            Track bills, split them equally, record settlements, and keep the whole
            house aligned. This starter is local-first, installable on Android, and
            ready for free static hosting on Cloudflare Pages.
          </p>
        </div>
        <div className="hero-side">
          <div className="hero-stat">
            <span>Total tracked</span>
            <strong>{formatCurrency(totalExpenses)}</strong>
          </div>
          <div className="hero-stat">
            <span>Members</span>
            <strong>{data.members.length || 0}</strong>
          </div>
          <div className="hero-stat">
            <span>Settled so far</span>
            <strong>{formatCurrency(settledAmount)}</strong>
          </div>
        </div>
      </header>

      {notice ? (
        <div className={`notice notice--${notice.tone}`} role="status">
          {notice.text}
        </div>
      ) : null}

      {data.members.length === 0 ? (
        <section className="setup-grid">
          <article className="panel panel--tall">
            <div className="panel-heading">
              <div>
                <p className="panel-kicker">Start here</p>
                <h2>Create your house group</h2>
              </div>
              <button className="ghost-button" onClick={loadDemoData}>
                Load demo data
              </button>
            </div>

            <form className="stack" onSubmit={createHousehold}>
              <label className="field">
                <span>House name</span>
                <input
                  value={setupHouseName}
                  onChange={(event) => setSetupHouseName(event.target.value)}
                  placeholder="Green Meadows Flat"
                />
              </label>

              <div className="member-composer">
                <div className="member-row">
                  <label className="field">
                    <span>Member name</span>
                    <input
                      value={setupMemberName}
                      onChange={(event) => setSetupMemberName(event.target.value)}
                      placeholder="Priya"
                    />
                  </label>

                  <label className="field field--compact">
                    <span>Role</span>
                    <select
                      value={setupMemberRole}
                      onChange={(event) =>
                        setSetupMemberRole(event.target.value as MemberRole)
                      }
                    >
                      <option value="tenant">Tenant</option>
                      <option value="owner">Owner</option>
                    </select>
                  </label>

                  <button
                    className="secondary-button"
                    type="button"
                    onClick={addSetupMember}
                  >
                    Add member
                  </button>
                </div>

                <div className="chip-wrap">
                  {setupMembers.map((member) => (
                    <span className="member-chip" key={member.id}>
                      {member.name}
                      <em>{member.role}</em>
                    </span>
                  ))}
                </div>
              </div>

              <button className="primary-button" type="submit">
                Create household
              </button>
            </form>
          </article>

          <article className="panel">
            <div className="panel-heading">
              <div>
                <p className="panel-kicker">Why this stack</p>
                <h2>Android-friendly and free to host</h2>
              </div>
            </div>
            <ul className="feature-list">
              <li>Installable PWA works well on Android phones right away.</li>
              <li>Cloudflare Pages can host this static app on the free tier.</li>
              <li>Local storage means it already works offline without a backend.</li>
              <li>We can add Cloudflare D1 or Firebase sync later without rebuilding from scratch.</li>
            </ul>
          </article>
        </section>
      ) : (
        <>
          <section className="dashboard-grid">
            <article className="panel">
              <div className="panel-heading">
                <div>
                  <p className="panel-kicker">{data.houseName}</p>
                  <h2>Balance dashboard</h2>
                </div>
                <span className="badge">Live split engine</span>
              </div>

              <div className="stats-grid">
                <div className="stat-card">
                  <span>Household spend</span>
                  <strong>{formatCurrency(totalExpenses)}</strong>
                </div>
                <div className="stat-card">
                  <span>Pending settlement</span>
                  <strong>{formatCurrency(pendingAmount / 2)}</strong>
                </div>
                <div className="stat-card">
                  <span>Expenses logged</span>
                  <strong>{data.expenses.length}</strong>
                </div>
              </div>

              <div className="balance-list">
                {balances.map((row) => (
                  <div className="balance-card" key={row.member.id}>
                    <div>
                      <h3>{row.member.name}</h3>
                      <p>
                        {row.member.role === 'owner' ? 'Owner' : 'Tenant'} · Paid{' '}
                        {formatCurrency(row.paid)}
                      </p>
                    </div>
                    <div className={row.amount >= 0 ? 'amount positive' : 'amount negative'}>
                      {row.amount >= 0 ? 'Gets back ' : 'Owes '}
                      {formatCurrency(Math.abs(row.amount))}
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="panel">
              <div className="panel-heading">
                <div>
                  <p className="panel-kicker">Settlement helper</p>
                  <h2>Suggested paybacks</h2>
                </div>
              </div>

              {suggestedSettlements.length > 0 ? (
                <div className="suggestion-list">
                  {suggestedSettlements.map((item, index) => (
                    <div className="suggestion-card" key={`${item.fromMember.id}-${index}`}>
                      <span>{item.fromMember.name}</span>
                      <strong>{formatCurrency(item.amount)}</strong>
                      <span>{item.toMember.name}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="empty-state">Everyone is square right now.</p>
              )}

              <div className="member-strip">
                {data.members.map((member) => (
                  <span className="member-chip" key={member.id}>
                    {member.name}
                    <em>{member.role}</em>
                  </span>
                ))}
              </div>
            </article>
          </section>

          <section className="actions-grid">
            <article className="panel">
              <div className="panel-heading">
                <div>
                  <p className="panel-kicker">Log an expense</p>
                  <h2>Add shared cost</h2>
                </div>
              </div>

              <form className="stack" onSubmit={addExpense}>
                <label className="field">
                  <span>Title</span>
                  <input
                    value={expenseTitle}
                    onChange={(event) => setExpenseTitle(event.target.value)}
                    placeholder="Water bill"
                  />
                </label>

                <div className="inline-fields">
                  <label className="field">
                    <span>Amount</span>
                    <input
                      inputMode="decimal"
                      value={expenseAmount}
                      onChange={(event) => setExpenseAmount(event.target.value)}
                      placeholder="1600"
                    />
                  </label>

                  <label className="field">
                    <span>Paid by</span>
                    <select
                      value={selectedExpensePayer}
                      onChange={(event) => setExpensePaidBy(event.target.value)}
                    >
                      {data.members.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="inline-fields">
                  <label className="field">
                    <span>Date</span>
                    <input
                      type="date"
                      value={expenseDate}
                      onChange={(event) => setExpenseDate(event.target.value)}
                    />
                  </label>

                  <label className="field">
                    <span>Category</span>
                    <select
                      value={expenseCategory}
                      onChange={(event) =>
                        setExpenseCategory(event.target.value as ExpenseCategory)
                      }
                    >
                      {CATEGORY_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <p className="helper-text">
                  This version splits each expense equally among all current members.
                </p>

                <button className="primary-button" type="submit">
                  Save expense
                </button>
              </form>
            </article>

            <article className="panel">
              <div className="panel-heading">
                <div>
                  <p className="panel-kicker">Record a payment</p>
                  <h2>Settle balances</h2>
                </div>
              </div>

              <form className="stack" onSubmit={addSettlement}>
                <div className="inline-fields">
                  <label className="field">
                    <span>Who paid</span>
                    <select
                      value={selectedSettlementFrom}
                      onChange={(event) => setSettlementFrom(event.target.value)}
                    >
                      {data.members.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field">
                    <span>Paid to</span>
                    <select
                      value={selectedSettlementTo}
                      onChange={(event) => setSettlementTo(event.target.value)}
                    >
                      {data.members.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="inline-fields">
                  <label className="field">
                    <span>Amount</span>
                    <input
                      inputMode="decimal"
                      value={settlementAmount}
                      onChange={(event) => setSettlementAmount(event.target.value)}
                      placeholder="500"
                    />
                  </label>

                  <label className="field">
                    <span>Date</span>
                    <input
                      type="date"
                      value={settlementDate}
                      onChange={(event) => setSettlementDate(event.target.value)}
                    />
                  </label>
                </div>

                <button className="secondary-button" type="submit">
                  Record settlement
                </button>
              </form>
            </article>

            <article className="panel">
              <div className="panel-heading">
                <div>
                  <p className="panel-kicker">Manage members</p>
                  <h2>Add new people</h2>
                </div>
              </div>

              <form className="stack" onSubmit={addMember}>
                <label className="field">
                  <span>Name</span>
                  <input
                    value={memberName}
                    onChange={(event) => setMemberName(event.target.value)}
                    placeholder="New tenant"
                  />
                </label>

                <label className="field">
                  <span>Role</span>
                  <select
                    value={memberRole}
                    onChange={(event) => setMemberRole(event.target.value as MemberRole)}
                  >
                    <option value="tenant">Tenant</option>
                    <option value="owner">Owner</option>
                  </select>
                </label>

                <button className="ghost-button" type="submit">
                  Add member
                </button>
              </form>
            </article>
          </section>

          <section className="details-grid">
            <article className="panel panel--wide">
              <div className="panel-heading">
                <div>
                  <p className="panel-kicker">Expense history</p>
                  <h2>Filter the ledger</h2>
                </div>
              </div>

              <div className="filter-row">
                <label className="field">
                  <span>Month</span>
                  <input
                    type="month"
                    value={historyMonthFilter}
                    onChange={(event) => setHistoryMonthFilter(event.target.value)}
                  />
                </label>

                <label className="field">
                  <span>Category</span>
                  <select
                    value={historyCategoryFilter}
                    onChange={(event) =>
                      setHistoryCategoryFilter(
                        event.target.value as 'All' | ExpenseCategory,
                      )
                    }
                  >
                    <option value="All">All</option>
                    {CATEGORY_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Payer</span>
                  <select
                    value={historyMemberFilter}
                    onChange={(event) => setHistoryMemberFilter(event.target.value)}
                  >
                    <option value="all">Everyone</option>
                    {data.members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="ledger">
                {filteredExpenses.length > 0 ? (
                  filteredExpenses.map((expense) => {
                    const payer = data.members.find(
                      (member) => member.id === expense.paidByMemberId,
                    )
                    const share = expense.amount / expense.splitAmongMemberIds.length

                    return (
                      <div className="ledger-row" key={expense.id}>
                        <div>
                          <h3>{expense.title}</h3>
                          <p>
                            {expense.date} · {expense.category} · Paid by{' '}
                            {payer?.name ?? 'Unknown'}
                          </p>
                        </div>
                        <div className="ledger-amount">
                          <strong>{formatCurrency(expense.amount)}</strong>
                          <span>{formatCurrency(share)} per person</span>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <p className="empty-state">No expenses match these filters yet.</p>
                )}
              </div>
            </article>

            <article className="panel">
              <div className="panel-heading">
                <div>
                  <p className="panel-kicker">Monthly summary</p>
                  <h2>{summaryMonth}</h2>
                </div>
              </div>

              <label className="field">
                <span>Month</span>
                <input
                  type="month"
                  value={summaryMonth}
                  onChange={(event) => setSummaryMonth(event.target.value)}
                />
              </label>

              <div className="summary-stack">
                <div className="summary-card">
                  <span>Total expenses</span>
                  <strong>{formatCurrency(monthlySummary.totalExpenses)}</strong>
                </div>
                <div className="summary-card">
                  <span>Expenses logged</span>
                  <strong>{monthlySummary.expensesCount}</strong>
                </div>
                <div className="summary-card">
                  <span>Settlements logged</span>
                  <strong>{monthlySummary.settlementsCount}</strong>
                </div>
              </div>

              <div className="summary-block">
                <h3>Category totals</h3>
                {monthlySummary.categories.length > 0 ? (
                  monthlySummary.categories.map((row) => (
                    <div className="summary-line" key={row.category}>
                      <span>{row.category}</span>
                      <strong>{formatCurrency(row.total)}</strong>
                    </div>
                  ))
                ) : (
                  <p className="empty-state">No expenses logged for this month.</p>
                )}
              </div>

              <div className="summary-block">
                <h3>Per-person position</h3>
                {monthlySummary.balances.map((row) => (
                  <div className="summary-line" key={row.member.id}>
                    <span>{row.member.name}</span>
                    <strong>{formatCurrency(row.amount)}</strong>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <footer className="app-footer">
            <div>
              <strong>Offline-first MVP</strong>
              <p>
                Your household data is currently stored on this device. The next step
                can be sync with Cloudflare D1 or Firebase.
              </p>
            </div>
            <button className="ghost-button" onClick={resetAllData}>
              Reset local data
            </button>
          </footer>
        </>
      )}
    </div>
  )
}

export default App
