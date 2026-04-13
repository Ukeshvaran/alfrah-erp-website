from flask import Flask, request, jsonify, make_response, render_template
from flask_cors import CORS
from flask_bcrypt import Bcrypt
from models import db, TeamLead, TeamMember, DailyPerformance, SaleEntry, MonthlySalary
from dotenv import load_dotenv
from datetime import datetime, date, timedelta, timezone
import calendar
from functools import wraps
from sqlalchemy import func, extract, inspect, text
import os
import hashlib
import csv
import io

load_dotenv()

app = Flask(__name__, static_folder='static', template_folder='templates')
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv(
    'DATABASE_URL',
    'postgresql+psycopg2://postgres:postgres@localhost:5432/alfrah_erp'
)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Simple CORS - allow all for testing
CORS(app, supports_credentials=True, origins=['http://localhost:5173', 'http://127.0.0.1:5173'])

bcrypt = Bcrypt(app)
db.init_app(app)

EXCLUDED_TARGET_PACK_TYPES = {'Internship', 'Demo'}


def ensure_schema_updates():
    """Add new columns on existing databases (PostgreSQL-oriented)."""
    try:
        insp = inspect(db.engine)
        tables = insp.get_table_names()
        if 'team_leads' in tables:
            cols = {c['name'] for c in insp.get_columns('team_leads')}
            added_team_name = False
            if 'team_name' not in cols:
                db.session.execute(text(
                    "ALTER TABLE team_leads ADD COLUMN team_name VARCHAR(150) NOT NULL DEFAULT ''"
                ))
                added_team_name = True
            if 'is_admin' not in cols:
                db.session.execute(text(
                    "ALTER TABLE team_leads ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT false"
                ))
            db.session.commit()
            if added_team_name:
                db.session.execute(text(
                    "UPDATE team_leads SET team_name = name WHERE TRIM(COALESCE(team_name, '')) = ''"
                ))
                db.session.commit()
        if 'sale_entries' in tables:
            cols = {c['name'] for c in insp.get_columns('sale_entries')}
            if 'client_ref' not in cols:
                db.session.execute(text(
                    "ALTER TABLE sale_entries ADD COLUMN client_ref VARCHAR(120)"
                ))
            if 'created_at' not in cols:
                db.session.execute(text(
                    "ALTER TABLE sale_entries ADD COLUMN created_at TIMESTAMP"
                ))
                db.session.execute(text(
                    "UPDATE sale_entries SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL"
                ))
            db.session.commit()
    except Exception as e:
        db.session.rollback()
        print(f"Schema update note (safe to ignore if columns exist): {e}")


def lead_display_team(lead):
    t = (lead.team_name or '').strip()
    return t if t else 'Unnamed team'


def parse_since_datetime(s):
    if not s or not str(s).strip():
        return None
    s = str(s).strip().replace('Z', '+00:00')
    dt = datetime.fromisoformat(s)
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def sync_sale_entries_for_performance(performance, sales_entries, incentive_mode, daily_given):
    """Upsert sale lines by stable client id; drop removed lines. Preserves created_at on updates."""
    incoming = sales_entries or []
    incoming_keys = []
    for ed in incoming:
        rid = ed.get('id')
        if rid is None or rid == '':
            continue
        incoming_keys.append(str(rid))
    incoming_key_set = set(incoming_keys)

    existing_rows = SaleEntry.query.filter_by(
        daily_performance_id=performance.id
    ).order_by(SaleEntry.id.asc()).all()
    existing_by_key = {}
    for se in existing_rows:
        key = se.client_ref if se.client_ref else str(se.id)
        existing_by_key[key] = se

    for ed in incoming:
        rid = ed.get('id')
        if rid is None or rid == '':
            continue
        key = str(rid)
        amount = float(ed.get('amount', 0) or 0)
        pack = ed.get('packType', 'Standard')
        se = existing_by_key.get(key)
        if se:
            se.amount = amount
            se.pack_type = pack
            se.incentive_type = incentive_mode
            se.daily_given = daily_given
            if not se.client_ref:
                se.client_ref = key
        else:
            se = SaleEntry(
                daily_performance_id=performance.id,
                client_ref=key,
                amount=amount,
                pack_type=pack,
                incentive_type=incentive_mode,
                incentive_amount=0,
                daily_given=daily_given,
            )
            db.session.add(se)
            existing_by_key[key] = se

    for se in list(existing_rows):
        key = se.client_ref if se.client_ref else str(se.id)
        if key not in incoming_key_set:
            db.session.delete(se)


# Create tables
with app.app_context():
    db.create_all()
    ensure_schema_updates()

# Helper function to convert string date to date object
def parse_date(date_string):
    if isinstance(date_string, str):
        return datetime.strptime(date_string, '%Y-%m-%d').date()
    return date_string


def get_incentive_rate(sales_count):
    if sales_count == 1:
        return 0.05
    if sales_count == 2:
        return 0.06
    if sales_count == 3:
        return 0.07
    if sales_count >= 4:
        return 0.08
    return 0.0


def calculate_salary_details(total_revenue, total_sales):
    target_amount = 70000.0
    eligible_for_salary = total_sales >= 8
    achieved_amount = total_revenue
    remaining_to_target = max(target_amount - achieved_amount, 0.0)
    salary = total_revenue * 0.25 if eligible_for_salary else 0.0

    return {
        'salary': salary,
        'eligible_for_salary': eligible_for_salary,
        'achieved_amount': achieved_amount,
        'remaining_to_target': remaining_to_target
    }


def safe_date(year, month, day):
    last_day = calendar.monthrange(year, month)[1]
    return date(year, month, min(day, last_day))


def get_salary_cycle_bounds(join_date, selected_date):
    anchor_day = join_date.day if join_date else 1
    current_candidate = safe_date(selected_date.year, selected_date.month, anchor_day)

    if selected_date >= current_candidate:
        cycle_start = current_candidate
    else:
        if selected_date.month == 1:
            prev_year, prev_month = selected_date.year - 1, 12
        else:
            prev_year, prev_month = selected_date.year, selected_date.month - 1
        cycle_start = safe_date(prev_year, prev_month, anchor_day)

    if cycle_start.month == 12:
        next_year, next_month = cycle_start.year + 1, 1
    else:
        next_year, next_month = cycle_start.year, cycle_start.month + 1
    next_cycle_start = safe_date(next_year, next_month, anchor_day)
    cycle_end = next_cycle_start - timedelta(days=1)
    return cycle_start, cycle_end


def calculate_cycle_salary_for_member(team_member_id, cycle_start, cycle_end):
    cycle_performances = DailyPerformance.query.filter(
        DailyPerformance.team_member_id == team_member_id,
        DailyPerformance.date.between(cycle_start, cycle_end)
    ).all()

    cycle_revenue = 0.0
    cycle_sales = 0
    incentive_total = 0.0
    incentive_added_to_salary = 0.0

    for perf in cycle_performances:
        day_entries = perf.sales_entries or []
        if not day_entries:
            continue

        eligible_day_entries = [
            entry for entry in day_entries
            if (entry.pack_type or '') not in EXCLUDED_TARGET_PACK_TYPES
        ]
        if not eligible_day_entries:
            continue

        day_revenue = sum(float(entry.amount or 0) for entry in eligible_day_entries)
        day_sales = len(eligible_day_entries)
        day_incentive_rate = get_incentive_rate(day_sales)
        day_incentive_amount = day_revenue * day_incentive_rate
        incentive_total += day_incentive_amount

        # Incentive is included in salary unless it is daily and already given.
        incentive_mode = day_entries[0].incentive_type
        daily_given = bool(day_entries[0].daily_given)
        should_add_incentive = incentive_mode == 'monthly' or not daily_given
        if should_add_incentive:
            incentive_added_to_salary += day_incentive_amount

        cycle_revenue += day_revenue
        cycle_sales += day_sales

    salary_details = calculate_salary_details(cycle_revenue, cycle_sales)
    base_salary = salary_details['salary']
    total_salary_with_incentive = base_salary + (incentive_added_to_salary if salary_details['eligible_for_salary'] else 0.0)

    return {
        'cycle_revenue': cycle_revenue,
        'cycle_sales': cycle_sales,
        'cycle_salary': total_salary_with_incentive,
        'base_salary': base_salary,
        'incentive_total': incentive_total,
        'incentive_added_to_salary': incentive_added_to_salary,
        'eligible_for_salary': salary_details['eligible_for_salary'],
        'achieved_amount': salary_details['achieved_amount'],
        'remaining_to_target': salary_details['remaining_to_target']
    }


def calculate_daily_totals(sales_entries, incentive_type='monthly', daily_given=False):
    total_revenue = 0.0
    total_sales = 0
    for entry in sales_entries:
        amount = float(entry.get('amount', 0) or 0)
        total_revenue += amount
        total_sales += 1

    salary_details = calculate_salary_details(total_revenue, total_sales)

    return {
        'total_revenue': total_revenue,
        'total_sales': total_sales,
        'salary': salary_details['salary'],
        'eligible_for_salary': salary_details['eligible_for_salary'],
        'achieved_amount': salary_details['achieved_amount'],
        'remaining_to_target': salary_details['remaining_to_target']
    }


@app.route('/', methods=['GET'])
def home():
    return render_template('index.html')

# Auth decorator - checks if username exists in database
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Get username from headers
        username = request.headers.get('X-Username')
        
        if not username:
            return jsonify({'error': 'Username is required'}), 401
        
        # Check if user exists in database
        team_lead = TeamLead.query.filter_by(name=username).first()
        if not team_lead:
            return jsonify({'error': 'User not found. Please login first.'}), 401
        
        # Store user info in request context for use in route
        request.current_user = team_lead
        return f(*args, **kwargs)
    return decorated_function


def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        username = request.headers.get('X-Username')
        if not username:
            return jsonify({'error': 'Username is required'}), 401
        team_lead = TeamLead.query.filter_by(name=username).first()
        if not team_lead:
            return jsonify({'error': 'User not found. Please login first.'}), 401
        if not team_lead.is_admin:
            return jsonify({'error': 'Admin access required'}), 403
        request.current_user = team_lead
        return f(*args, **kwargs)
    return decorated_function


# Login route — only team leads already in team_leads (e.g. seeded via script) may sign in
@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.json
    name = data.get('name')
    access_code = data.get('access_code')
    
    # Validate input
    if not name or not name.strip():
        return jsonify({'error': 'Name is required'}), 400
    
    if not access_code or not access_code.strip():
        return jsonify({'error': 'Access code is required'}), 400
    
    team_lead = TeamLead.query.filter_by(name=name.strip()).first()
    if not team_lead:
        return jsonify({'error': 'Invalid name or access code'}), 401

    if not bcrypt.check_password_hash(team_lead.access_code, access_code):
        return jsonify({'error': 'Invalid name or access code'}), 401

    print(f"✅ User logged in: {name}")
    
    # Return user info (no session!)
    return jsonify({
        'id': team_lead.id,
        'name': team_lead.name,
        'team_name': lead_display_team(team_lead),
        'is_admin': bool(team_lead.is_admin),
    }), 200

# Get current user info
@app.route('/api/auth/me', methods=['POST'])
def get_current_user():
    data = request.json
    username = data.get('username')
    
    if not username:
        return jsonify({'error': 'Username required'}), 401
    
    team_lead = TeamLead.query.filter_by(name=username).first()
    if not team_lead:
        return jsonify({'error': 'User not found'}), 401
    
    return jsonify({
        'id': team_lead.id,
        'name': team_lead.name,
        'team_name': lead_display_team(team_lead),
        'is_admin': bool(team_lead.is_admin),
    }), 200

# Team Member Routes
@app.route('/api/team-members', methods=['GET'])
@login_required
def get_team_members():
    team_lead = request.current_user
    members = TeamMember.query.filter_by(team_lead_id=team_lead.id, active=True).all()
    return jsonify([{
        'id': m.id,
        'name': m.name,
        'role': m.role,
        'couponCode': m.coupon_code,
        'created_at': m.created_at.isoformat()
    } for m in members]), 200

@app.route('/api/team-members', methods=['POST'])
@login_required
def add_team_member():
    team_lead = request.current_user
    data = request.json
    
    if not data.get('name') or not data['name'].strip():
        return jsonify({'error': 'Member name is required'}), 400
    
    new_member = TeamMember(
        team_lead_id=team_lead.id,
        name=data['name'].strip(),
        role=data.get('role', 'Team Member'),
        coupon_code=data.get('couponCode', '')
    )
    
    db.session.add(new_member)
    db.session.commit()
    
    return jsonify({
        'id': new_member.id,
        'name': new_member.name,
        'role': new_member.role,
        'couponCode': new_member.coupon_code
    }), 201

@app.route('/api/team-members/<int:member_id>', methods=['DELETE'])
@login_required
def delete_team_member(member_id):
    team_lead = request.current_user
    member = TeamMember.query.get_or_404(member_id)
    
    # Verify ownership
    if member.team_lead_id != team_lead.id:
        return jsonify({'error': 'Unauthorized'}), 403
    
    member.active = False
    db.session.commit()
    
    return jsonify({'message': 'Member removed successfully'}), 200

@app.route('/api/report', methods=['GET'])
@login_required
def download_report():
    team_lead = request.current_user
    start_date_str = request.args.get('start_date')
    end_date_str = request.args.get('end_date')

    if not start_date_str or not end_date_str:
        return jsonify({'error': 'Start date and end date are required'}), 400

    try:
        start_date = parse_date(start_date_str)
        end_date = parse_date(end_date_str)
    except:
        return jsonify({'error': 'Invalid date format'}), 400

    if end_date < start_date:
        return jsonify({'error': 'End date must be after start date'}), 400

    members = TeamMember.query.filter_by(team_lead_id=team_lead.id, active=True).all()
    member_ids = [m.id for m in members]

    sales = SaleEntry.query.join(DailyPerformance).filter(
        DailyPerformance.team_member_id.in_(member_ids),
        DailyPerformance.date.between(start_date, end_date)
    ).all()

    pack_types = ['Origin', 'Prime', 'Elite', 'Alfrah Ultra', 'Internship', 'Demo']
    report_data = {}
    for member in members:
        report_data[member.id] = {
            'name': member.name,
            'coupon': member.coupon_code or '',
            'counts': {pack: 0 for pack in pack_types},
            'total_sales': 0,
            'total_revenue': 0.0
        }

    for entry in sales:
        perf = entry.daily_performance
        if not perf or perf.team_member_id not in report_data:
            continue

        member_report = report_data[perf.team_member_id]
        pack_name = entry.pack_type or 'Origin'
        if pack_name not in member_report['counts']:
            member_report['counts'][pack_name] = 0

        member_report['counts'][pack_name] += 1
        member_report['total_sales'] += 1
        member_report['total_revenue'] += float(entry.amount or 0)

    output = io.StringIO()
    writer = csv.writer(output)
    header = ['Team Member', 'Coupon Code'] + pack_types + ['Total Sales', 'Total Revenue']
    writer.writerow(header)

    for member_id, row in report_data.items():
        writer.writerow([
            row['name'],
            row['coupon'],
            *[row['counts'][pack] for pack in pack_types],
            row['total_sales'],
            f"{row['total_revenue']:.2f}"
        ])

    response = make_response(output.getvalue())
    response.headers['Content-Disposition'] = f'attachment; filename=team-report-{start_date_str}-{end_date_str}.csv'
    response.headers['Content-Type'] = 'text/csv; charset=utf-8'
    return response

# Performance Routes
@app.route('/api/performance', methods=['GET'])
@login_required
def get_performance():
    team_lead = request.current_user
    date_str = request.args.get('date')
    
    if not date_str:
        return jsonify({'error': 'Date is required'}), 400
    
    # Convert string to date object
    try:
        selected_date = parse_date(date_str)
    except:
        return jsonify({'error': 'Invalid date format'}), 400
    
    # Get all team members for this lead
    members = TeamMember.query.filter_by(team_lead_id=team_lead.id, active=True).all()
    member_ids = [m.id for m in members]
    
    # Get performance data for the date
    performances = DailyPerformance.query.filter(
        DailyPerformance.team_member_id.in_(member_ids),
        DailyPerformance.date == selected_date
    ).all()
    
    performance_dict = {p.team_member_id: p for p in performances}
    
    result = []
    for member in members:
        perf = performance_dict.get(member.id)
        sales_entries = []
        if perf:
            for entry in perf.sales_entries:
                sales_entries.append({
                    'id': entry.client_ref if entry.client_ref else str(entry.id),
                    'amount': float(entry.amount),
                    'packType': entry.pack_type
                })

        incentive_mode = 'monthly'
        daily_given = False
        if perf and perf.sales_entries:
            incentive_mode = perf.sales_entries[0].incentive_type
            daily_given = bool(perf.sales_entries[0].daily_given)

        if sales_entries:
            totals = calculate_daily_totals(sales_entries, incentive_mode, daily_given)
        else:
            totals = {
                'total_revenue': float(perf.revenue) if perf else 0,
                'total_sales': perf.sales if perf else 0
            }

        cycle_start, cycle_end = get_salary_cycle_bounds(member.created_at.date(), selected_date)
        cycle_salary = calculate_cycle_salary_for_member(member.id, cycle_start, cycle_end)
        stored_cycle_salary = MonthlySalary.query.filter_by(
            team_member_id=member.id,
            cycle_start=cycle_start
        ).first()

        result.append({
            'team_member_id': member.id,
            'revenue': totals['total_revenue'],
            'sales': totals['total_sales'],
            'salary': float(stored_cycle_salary.salary_earned) if stored_cycle_salary else cycle_salary['cycle_salary'],
            'salaryPaid': float(stored_cycle_salary.salary_paid) if stored_cycle_salary and stored_cycle_salary.salary_paid else 0,
            'incentiveTotal': cycle_salary['incentive_total'],
            'incentiveAddedToSalary': cycle_salary['incentive_added_to_salary'],
            'eligibleForSalary': cycle_salary['eligible_for_salary'],
            'achievedAmount': cycle_salary['achieved_amount'],
            'remainingToTarget': cycle_salary['remaining_to_target'],
            'monthlyRevenue': cycle_salary['cycle_revenue'],
            'monthlySales': cycle_salary['cycle_sales'],
            'cycleStart': cycle_start.isoformat(),
            'cycleEnd': cycle_end.isoformat(),
            'attendance': perf.attendance if perf else True,
            'notes': perf.notes if perf else '',
            'incentiveMode': incentive_mode,
            'dailyGiven': daily_given,
            'salesEntries': sales_entries
        })
    
    return jsonify(result), 200

@app.route('/api/performance', methods=['POST'])
@login_required
def save_performance():
    team_lead = request.current_user
    data = request.json
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    date_str = data[0].get('date') if data else None
    if not date_str:
        return jsonify({'error': 'Date is required'}), 400
    
    # Convert string to date object
    try:
        selected_date = parse_date(date_str)
    except:
        return jsonify({'error': 'Invalid date format'}), 400
    
    for perf_data in data:
        # Verify team member belongs to this team lead
        member = TeamMember.query.get(perf_data['team_member_id'])
        if not member or member.team_lead_id != team_lead.id:
            continue
        
        # Check if performance record exists
        performance = DailyPerformance.query.filter_by(
            team_member_id=perf_data['team_member_id'],
            date=selected_date
        ).first()
        
        sales_entries = perf_data.get('salesEntries', []) or []
        incentive_mode = perf_data.get('incentiveMode', 'monthly')
        daily_given = bool(perf_data.get('dailyGiven', False))
        totals = calculate_daily_totals(sales_entries, incentive_mode, daily_given)

        if performance:
            # Update existing
            performance.revenue = totals['total_revenue']
            performance.sales = totals['total_sales']
            performance.attendance = perf_data.get('attendance', True)
            performance.notes = perf_data.get('notes', '')
            performance.updated_at = datetime.utcnow()
        else:
            # Create new
            performance = DailyPerformance(
                team_member_id=perf_data['team_member_id'],
                date=selected_date,
                revenue=totals['total_revenue'],
                sales=totals['total_sales'],
                attendance=perf_data.get('attendance', True),
                notes=perf_data.get('notes', '')
            )
            db.session.add(performance)
            db.session.flush()

        sync_sale_entries_for_performance(performance, sales_entries, incentive_mode, daily_given)
        db.session.flush()

        cycle_start, cycle_end = get_salary_cycle_bounds(member.created_at.date(), selected_date)
        cycle_salary = calculate_cycle_salary_for_member(member.id, cycle_start, cycle_end)
        salary_paid_value = float(perf_data.get('salaryPaid', 0) or 0)

        monthly_salary = MonthlySalary.query.filter_by(
            team_member_id=perf_data['team_member_id'],
            cycle_start=cycle_start
        ).first()
        if monthly_salary:
            monthly_salary.cycle_end = cycle_end
            monthly_salary.cycle_revenue = cycle_salary['cycle_revenue']
            monthly_salary.cycle_sales = cycle_salary['cycle_sales']
            monthly_salary.salary_earned = cycle_salary['cycle_salary']
            monthly_salary.incentive_total = cycle_salary['incentive_total']
            monthly_salary.incentive_added = cycle_salary['incentive_added_to_salary']
            monthly_salary.salary_paid = salary_paid_value
            monthly_salary.updated_at = datetime.utcnow()
        else:
            monthly_salary = MonthlySalary(
                team_member_id=perf_data['team_member_id'],
                cycle_start=cycle_start,
                cycle_end=cycle_end,
                cycle_revenue=cycle_salary['cycle_revenue'],
                cycle_sales=cycle_salary['cycle_sales'],
                salary_earned=cycle_salary['cycle_salary'],
                incentive_total=cycle_salary['incentive_total'],
                incentive_added=cycle_salary['incentive_added_to_salary'],
                salary_paid=salary_paid_value
            )
            db.session.add(monthly_salary)
    
    try:
        db.session.commit()
        return jsonify({'message': 'Performance data saved successfully'}), 200
    except Exception as e:
        db.session.rollback()
        print(f"Error saving performance data: {e}")
        return jsonify({'error': 'Failed to save performance data'}), 500

# Analytics Routes
@app.route('/api/analytics', methods=['GET'])
@login_required
def get_analytics():
    team_lead = request.current_user
    start_date_str = request.args.get('start_date')
    end_date_str = request.args.get('end_date')
    
    if not start_date_str or not end_date_str:
        return jsonify({'error': 'Start date and end date are required'}), 400
    
    # Convert strings to date objects
    try:
        start_date = parse_date(start_date_str)
        end_date = parse_date(end_date_str)
    except:
        return jsonify({'error': 'Invalid date format'}), 400
    
    # Get all team members (from all leads for analytics)
    query = db.session.query(
        TeamMember,
        TeamLead,
        DailyPerformance
    ).join(
        TeamLead, TeamMember.team_lead_id == TeamLead.id
    ).outerjoin(
        DailyPerformance, 
        DailyPerformance.team_member_id == TeamMember.id
    ).filter(
        DailyPerformance.date.between(start_date, end_date),
        TeamMember.active == True,
        TeamLead.is_admin == False
    )
    
    results = query.all()
    
    # Aggregate data
    aggregated = {}
    for member, lead, perf in results:
        if member.id not in aggregated:
            aggregated[member.id] = {
                'team_member_id': member.id,
                'team_member_name': member.name,
                'team_name': lead_display_team(lead),
                'total_revenue': 0,
                'total_sales': 0,
                'days_present': 0,
                'total_days': 0
            }
        
        if perf:
            aggregated[member.id]['total_revenue'] += float(perf.revenue)
            aggregated[member.id]['total_sales'] += perf.sales
            aggregated[member.id]['total_days'] += 1
            if perf.attendance:
                aggregated[member.id]['days_present'] += 1
    
    return jsonify(list(aggregated.values())), 200


@app.route('/api/admin/dashboard', methods=['GET'])
@admin_required
def admin_dashboard():
    today = date.today()
    month_start = date(today.year, today.month, 1)
    lead_ok = TeamLead.is_admin == False
    member_ok = TeamMember.active == True

    perf_today_rows = db.session.query(
        TeamMember.name,
        TeamLead.team_name,
        DailyPerformance.revenue,
        DailyPerformance.sales,
    ).select_from(DailyPerformance).join(
        TeamMember, DailyPerformance.team_member_id == TeamMember.id
    ).join(
        TeamLead, TeamMember.team_lead_id == TeamLead.id
    ).filter(
        DailyPerformance.date == today,
        member_ok,
        lead_ok,
    ).order_by(
        DailyPerformance.revenue.desc(),
        DailyPerformance.sales.desc(),
    ).all()

    performers_today = [
        {
            'member_name': mname,
            'team_name': (tname or '').strip() or 'Unnamed team',
            'revenue': float(rev or 0),
            'sales': int(sal or 0),
        }
        for mname, tname, rev, sal in perf_today_rows
    ]

    team_today_rows = db.session.query(
        TeamLead.team_name,
        func.coalesce(func.sum(DailyPerformance.revenue), 0).label('rev'),
        func.coalesce(func.sum(DailyPerformance.sales), 0).label('sal'),
    ).select_from(DailyPerformance).join(
        TeamMember, DailyPerformance.team_member_id == TeamMember.id
    ).join(
        TeamLead, TeamMember.team_lead_id == TeamLead.id
    ).filter(
        DailyPerformance.date == today,
        member_ok,
        lead_ok,
    ).group_by(
        TeamLead.id,
        TeamLead.team_name,
    ).order_by(
        func.coalesce(func.sum(DailyPerformance.revenue), 0).desc(),
        func.coalesce(func.sum(DailyPerformance.sales), 0).desc(),
    ).all()

    teams_today = [
        {
            'team_name': (r[0] or '').strip() or 'Unnamed team',
            'revenue': float(r[1] or 0),
            'sales': int(r[2] or 0),
        }
        for r in team_today_rows
    ]

    perf_month_rows = db.session.query(
        TeamMember.name,
        TeamLead.team_name,
        func.coalesce(func.sum(DailyPerformance.revenue), 0).label('rev'),
        func.coalesce(func.sum(DailyPerformance.sales), 0).label('sal'),
    ).select_from(DailyPerformance).join(
        TeamMember, DailyPerformance.team_member_id == TeamMember.id
    ).join(
        TeamLead, TeamMember.team_lead_id == TeamLead.id
    ).filter(
        DailyPerformance.date >= month_start,
        DailyPerformance.date <= today,
        member_ok,
        lead_ok,
    ).group_by(
        TeamMember.id,
        TeamMember.name,
        TeamLead.team_name,
    ).order_by(
        func.coalesce(func.sum(DailyPerformance.revenue), 0).desc(),
        func.coalesce(func.sum(DailyPerformance.sales), 0).desc(),
    ).all()

    performers_this_month = [
        {
            'member_name': r[0],
            'team_name': (r[1] or '').strip() or 'Unnamed team',
            'revenue': float(r[2] or 0),
            'sales': int(r[3] or 0),
        }
        for r in perf_month_rows
    ]

    team_month_rows = db.session.query(
        TeamLead.team_name,
        func.coalesce(func.sum(DailyPerformance.revenue), 0).label('rev'),
        func.coalesce(func.sum(DailyPerformance.sales), 0).label('sal'),
    ).select_from(DailyPerformance).join(
        TeamMember, DailyPerformance.team_member_id == TeamMember.id
    ).join(
        TeamLead, TeamMember.team_lead_id == TeamLead.id
    ).filter(
        DailyPerformance.date >= month_start,
        DailyPerformance.date <= today,
        member_ok,
        lead_ok,
    ).group_by(
        TeamLead.id,
        TeamLead.team_name,
    ).order_by(
        func.coalesce(func.sum(DailyPerformance.revenue), 0).desc(),
        func.coalesce(func.sum(DailyPerformance.sales), 0).desc(),
    ).all()

    teams_this_month = [
        {
            'team_name': (r[0] or '').strip() or 'Unnamed team',
            'revenue': float(r[1] or 0),
            'sales': int(r[2] or 0),
        }
        for r in team_month_rows
    ]

    total_revenue_today = float(
        db.session.query(func.coalesce(func.sum(DailyPerformance.revenue), 0))
        .select_from(DailyPerformance)
        .join(TeamMember, DailyPerformance.team_member_id == TeamMember.id)
        .join(TeamLead, TeamMember.team_lead_id == TeamLead.id)
        .filter(DailyPerformance.date == today, member_ok, lead_ok)
        .scalar() or 0
    )
    total_revenue_month = float(
        db.session.query(func.coalesce(func.sum(DailyPerformance.revenue), 0))
        .select_from(DailyPerformance)
        .join(TeamMember, DailyPerformance.team_member_id == TeamMember.id)
        .join(TeamLead, TeamMember.team_lead_id == TeamLead.id)
        .filter(
            DailyPerformance.date >= month_start,
            DailyPerformance.date <= today,
            member_ok,
            lead_ok,
        )
        .scalar() or 0
    )
    total_sales_today = int(
        db.session.query(func.coalesce(func.sum(DailyPerformance.sales), 0))
        .select_from(DailyPerformance)
        .join(TeamMember, DailyPerformance.team_member_id == TeamMember.id)
        .join(TeamLead, TeamMember.team_lead_id == TeamLead.id)
        .filter(DailyPerformance.date == today, member_ok, lead_ok)
        .scalar() or 0
    )
    total_sales_month = int(
        db.session.query(func.coalesce(func.sum(DailyPerformance.sales), 0))
        .select_from(DailyPerformance)
        .join(TeamMember, DailyPerformance.team_member_id == TeamMember.id)
        .join(TeamLead, TeamMember.team_lead_id == TeamLead.id)
        .filter(
            DailyPerformance.date >= month_start,
            DailyPerformance.date <= today,
            member_ok,
            lead_ok,
        )
        .scalar() or 0
    )

    rev_rows = db.session.query(
        extract('year', DailyPerformance.date).label('y'),
        extract('month', DailyPerformance.date).label('m'),
        func.coalesce(func.sum(DailyPerformance.revenue), 0).label('rev'),
    ).select_from(DailyPerformance).join(
        TeamMember, DailyPerformance.team_member_id == TeamMember.id
    ).join(
        TeamLead, TeamMember.team_lead_id == TeamLead.id
    ).filter(
        member_ok,
        lead_ok,
    ).group_by(
        extract('year', DailyPerformance.date),
        extract('month', DailyPerformance.date),
    ).order_by(
        extract('year', DailyPerformance.date),
        extract('month', DailyPerformance.date),
    ).all()

    revenue_by_month = [
        {
            'year': int(yv),
            'month': int(mv),
            'label': f'{int(yv)}-{int(mv):02d}',
            'total_revenue': float(rev or 0),
        }
        for yv, mv, rev in rev_rows
    ]

    sale_rows = db.session.query(
        SaleEntry,
        TeamMember.name,
        TeamLead.team_name,
    ).select_from(SaleEntry).join(
        DailyPerformance, SaleEntry.daily_performance_id == DailyPerformance.id
    ).join(
        TeamMember, DailyPerformance.team_member_id == TeamMember.id
    ).join(
        TeamLead, TeamMember.team_lead_id == TeamLead.id
    ).filter(
        DailyPerformance.date == today,
        member_ok,
        lead_ok,
    ).order_by(SaleEntry.id.desc()).all()

    today_sales = []
    for se, mname, tname in sale_rows:
        if float(se.amount or 0) <= 0:
            continue
        ca = se.created_at.isoformat() + 'Z' if se.created_at else None
        today_sales.append({
            'id': se.id,
            'member_name': mname,
            'team_name': (tname or '').strip() or 'Unnamed team',
            'amount': float(se.amount or 0),
            'pack_type': se.pack_type or '',
            'created_at': ca,
        })

    return jsonify({
        'performers_today': performers_today,
        'teams_today': teams_today,
        'performers_this_month': performers_this_month,
        'teams_this_month': teams_this_month,
        'total_revenue_today': total_revenue_today,
        'total_revenue_month': total_revenue_month,
        'total_sales_today': total_sales_today,
        'total_sales_month': total_sales_month,
        'revenue_by_month': revenue_by_month,
        'today_sales': today_sales,
    }), 200


@app.route('/api/admin/new-sales', methods=['GET'])
@admin_required
def admin_new_sales():
    since = request.args.get('since')
    since_dt = parse_since_datetime(since)
    if not since_dt:
        since_dt = datetime.utcnow() - timedelta(minutes=1)

    lead_ok = TeamLead.is_admin == False
    member_ok = TeamMember.active == True

    q = db.session.query(
        SaleEntry,
        TeamMember.name,
        TeamLead.team_name,
    ).select_from(SaleEntry).join(
        DailyPerformance, SaleEntry.daily_performance_id == DailyPerformance.id
    ).join(
        TeamMember, DailyPerformance.team_member_id == TeamMember.id
    ).join(
        TeamLead, TeamMember.team_lead_id == TeamLead.id
    ).filter(
        member_ok,
        lead_ok,
        SaleEntry.created_at.isnot(None),
        SaleEntry.created_at > since_dt,
        SaleEntry.amount > 0,
    ).order_by(SaleEntry.created_at.asc())

    out = []
    for se, mname, tname in q.all():
        ca = se.created_at.isoformat() + 'Z' if se.created_at else None
        out.append({
            'id': se.id,
            'member_name': mname,
            'team_name': (tname or '').strip() or 'Unnamed team',
            'amount': float(se.amount or 0),
            'pack_type': se.pack_type or '',
            'created_at': ca,
        })
    return jsonify({'sales': out}), 200


@app.route('/api/salary-cycles', methods=['GET'])
@login_required
def get_salary_cycles():
    team_lead = request.current_user

    members = TeamMember.query.filter_by(team_lead_id=team_lead.id, active=True).all()
    member_ids = [m.id for m in members]
    if not member_ids:
        return jsonify([]), 200

    member_name_map = {m.id: m.name for m in members}
    cycles = MonthlySalary.query.filter(
        MonthlySalary.team_member_id.in_(member_ids)
    ).order_by(
        MonthlySalary.team_member_id.asc(),
        MonthlySalary.cycle_start.desc()
    ).all()

    grouped = {}
    for cycle in cycles:
        member_id = cycle.team_member_id
        if member_id not in grouped:
            grouped[member_id] = {
                'team_member_id': member_id,
                'team_member_name': member_name_map.get(member_id, ''),
                'cycles': []
            }
        grouped[member_id]['cycles'].append({
            'cycleStart': cycle.cycle_start.isoformat(),
            'cycleEnd': cycle.cycle_end.isoformat(),
            'cycleRevenue': float(cycle.cycle_revenue or 0),
            'cycleSales': int(cycle.cycle_sales or 0),
            'incentiveTotal': float(cycle.incentive_total or 0),
            'incentiveAddedToSalary': float(cycle.incentive_added or 0),
            'salaryEarned': float(cycle.salary_earned or 0),
            'salaryPaid': float(cycle.salary_paid or 0),
            'salaryBalance': float((cycle.salary_earned or 0) - (cycle.salary_paid or 0))
        })

    return jsonify(list(grouped.values())), 200

if __name__ == '__main__':
    app.run(debug=True, port=5001)