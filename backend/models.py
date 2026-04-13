from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class TeamLead(db.Model):
    __tablename__ = 'team_leads'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    access_code = db.Column(db.String(200), nullable=False)
    team_name = db.Column(db.String(150), nullable=False, default='')
    is_admin = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    team_members = db.relationship('TeamMember', backref='team_lead', lazy=True)

class TeamMember(db.Model):
    __tablename__ = 'team_members'
    
    id = db.Column(db.Integer, primary_key=True)
    team_lead_id = db.Column(db.Integer, db.ForeignKey('team_leads.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    role = db.Column(db.String(100), default='Team Member')
    coupon_code = db.Column(db.String(100), default='')
    active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    performances = db.relationship('DailyPerformance', backref='team_member', lazy=True)
    monthly_salaries = db.relationship('MonthlySalary', backref='team_member', lazy=True, cascade='all, delete-orphan')

class DailyPerformance(db.Model):
    __tablename__ = 'daily_performances'
    
    id = db.Column(db.Integer, primary_key=True)
    team_member_id = db.Column(db.Integer, db.ForeignKey('team_members.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    revenue = db.Column(db.Float, default=0)
    sales = db.Column(db.Integer, default=0)
    attendance = db.Column(db.Boolean, default=True)
    notes = db.Column(db.Text, default='')
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    sales_entries = db.relationship('SaleEntry', backref='daily_performance', lazy=True, cascade='all, delete-orphan')
    
    __table_args__ = (db.UniqueConstraint('team_member_id', 'date', name='unique_member_date'),)

class SaleEntry(db.Model):
    __tablename__ = 'sale_entries'
    
    id = db.Column(db.Integer, primary_key=True)
    daily_performance_id = db.Column(db.Integer, db.ForeignKey('daily_performances.id'), nullable=False)
    client_ref = db.Column(db.String(120), nullable=True)
    amount = db.Column(db.Float, default=0)
    pack_type = db.Column(db.String(100), default='Standard')
    incentive_type = db.Column(db.String(50), default='monthly')
    incentive_amount = db.Column(db.Float, default=0)
    daily_given = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class MonthlySalary(db.Model):
    __tablename__ = 'monthly_salaries'

    id = db.Column(db.Integer, primary_key=True)
    team_member_id = db.Column(db.Integer, db.ForeignKey('team_members.id'), nullable=False)
    cycle_start = db.Column(db.Date, nullable=False)
    cycle_end = db.Column(db.Date, nullable=False)
    cycle_revenue = db.Column(db.Float, default=0)
    cycle_sales = db.Column(db.Integer, default=0)
    incentive_total = db.Column(db.Float, default=0)
    incentive_added = db.Column(db.Float, default=0)
    salary_earned = db.Column(db.Float, default=0)
    salary_paid = db.Column(db.Float, default=0)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (db.UniqueConstraint('team_member_id', 'cycle_start', name='unique_member_cycle_salary'),)
