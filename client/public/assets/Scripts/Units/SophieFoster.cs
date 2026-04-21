using UnityEngine;
using LostCity.Core;

namespace LostCity.Units
{
    public class SophieFoster : UnitBase
    {
        [SerializeField] private Abilities.TelepathyAbility _telepathy;

        public bool IsCaptured { get; private set; }
        public Abilities.TelepathyAbility TelepathyAbility => _telepathy;

        protected override void Awake()
        {
            base.Awake();
            if (_telepathy == null)
                _telepathy = GetComponentInChildren<Abilities.TelepathyAbility>();
        }

        public override void Die()
        {
            if (IsCaptured || State == UnitState.Dead) return;
            IsCaptured = true;
            State = UnitState.Dead;
            _agent.isStopped = true;

            EventBus.Publish(new SophieCapturedEvent());
            // Don't destroy Sophie — she's "captured", not dead
            gameObject.SetActive(false);
        }

        public bool UseTelepathy(Vector3 center)
        {
            if (_telepathy == null) return false;
            return _telepathy.TryActivate(center);
        }
    }
}
