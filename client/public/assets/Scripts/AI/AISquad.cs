using System;
using System.Collections.Generic;
using UnityEngine;
using LostCity.Units;

namespace LostCity.AI
{
    public class AISquad : MonoBehaviour
    {
        private readonly List<UnitBase> _members = new();
        private Transform _objective;

        public event Action<AISquad> OnSquadDestroyed;
        public int MemberCount => _members.Count;

        public void Initialize(List<UnitBase> units, Transform objective)
        {
            _members.AddRange(units);
            _objective = objective;

            foreach (var u in _members)
            {
                u.OnDeath += OnMemberDied;
                if (_objective != null)
                {
                    var target = _objective.GetComponent<Core.IDamageable>();
                    if (target != null)
                        u.OrderAttack(target);
                    else
                        u.MoveTo(_objective.position);
                }
            }
        }

        public void AssignObjective(Transform target)
        {
            _objective = target;
            foreach (var u in _members)
            {
                var damageable = target?.GetComponent<Core.IDamageable>();
                if (damageable != null) u.OrderAttack(damageable);
                else if (target != null) u.MoveTo(target.position);
            }
        }

        private void OnMemberDied(UnitBase unit)
        {
            unit.OnDeath -= OnMemberDied;
            _members.Remove(unit);
            if (_members.Count == 0)
            {
                OnSquadDestroyed?.Invoke(this);
                Destroy(gameObject);
            }
        }
    }
}
