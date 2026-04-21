using System;
using UnityEngine;
using UnityEngine.AI;
using LostCity.Core;
using LostCity.Data;

namespace LostCity.Units
{
    public enum UnitState { Idle, Moving, Attacking, UsingAbility, Dead }

    [RequireComponent(typeof(NavMeshAgent))]
    public abstract class UnitBase : MonoBehaviour, IDamageable, ISelectable
    {
        [SerializeField] protected UnitData _data;

        public UnitData Data => _data;
        public Faction Faction => _data != null ? _data.Faction : Faction.Neutral;
        public UnitState State { get; protected set; } = UnitState.Idle;

        public float MaxHealth => _data ? _data.MaxHealth : 100f;
        public float CurrentHealth { get; protected set; }

        public Transform Transform => transform;

        protected NavMeshAgent _agent;
        protected IDamageable _attackTarget;
        private float _attackTimer;

        public event Action<UnitBase> OnDeath;

        protected virtual void Awake()
        {
            _agent = GetComponent<NavMeshAgent>();
            if (_data != null)
            {
                CurrentHealth = _data.MaxHealth;
                _agent.speed = _data.MoveSpeed;
            }
        }

        protected virtual void Update()
        {
            if (State == UnitState.Dead) return;
            StateMachineUpdate();
        }

        protected virtual void StateMachineUpdate()
        {
            switch (State)
            {
                case UnitState.Moving:
                    if (!_agent.pathPending && _agent.remainingDistance < 0.2f)
                        State = UnitState.Idle;
                    break;

                case UnitState.Attacking:
                    if (_attackTarget == null || (_attackTarget as MonoBehaviour) == null)
                    {
                        State = UnitState.Idle;
                        break;
                    }
                    var targetMono = _attackTarget as MonoBehaviour;
                    float dist = Vector3.Distance(transform.position, targetMono.transform.position);
                    if (dist > _data.AttackRange)
                    {
                        _agent.SetDestination(targetMono.transform.position);
                    }
                    else
                    {
                        _agent.ResetPath();
                        _attackTimer -= Time.deltaTime;
                        if (_attackTimer <= 0f)
                        {
                            ExecuteAttack(_attackTarget);
                            _attackTimer = _data.AttackCooldown;
                        }
                    }
                    break;
            }
        }

        public void MoveTo(Vector3 destination)
        {
            if (State == UnitState.Dead) return;
            _attackTarget = null;
            _agent.SetDestination(destination);
            State = UnitState.Moving;
        }

        public virtual void OrderAttack(IDamageable target)
        {
            if (State == UnitState.Dead || target == null) return;
            _attackTarget = target;
            _attackTimer = 0f;
            State = UnitState.Attacking;
        }

        protected virtual void ExecuteAttack(IDamageable target)
        {
            target.TakeDamage(_data.AttackDamage);
        }

        public virtual void TakeDamage(float amount)
        {
            if (State == UnitState.Dead) return;
            CurrentHealth -= amount;
            if (CurrentHealth <= 0f) Die();
        }

        public virtual void Die()
        {
            if (State == UnitState.Dead) return;
            State = UnitState.Dead;
            _agent.isStopped = true;
            OnDeath?.Invoke(this);
            EventBus.Publish(new UnitDiedEvent { Unit = this, Faction = Faction });
            Destroy(gameObject, 1.5f);
        }

        public virtual void OnSelected()
        {
            // Override in subclass or handle via UI
        }

        public virtual void OnDeselected()
        {
            // Override in subclass or handle via UI
        }

        public void Initialize(UnitData data)
        {
            _data = data;
            CurrentHealth = data.MaxHealth;
            if (_agent == null) _agent = GetComponent<NavMeshAgent>();
            _agent.speed = data.MoveSpeed;
        }
    }
}
