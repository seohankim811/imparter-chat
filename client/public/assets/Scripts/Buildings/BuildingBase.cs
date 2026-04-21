using UnityEngine;
using LostCity.Core;
using LostCity.Data;

namespace LostCity.Buildings
{
    public abstract class BuildingBase : MonoBehaviour, IDamageable, ISelectable
    {
        [SerializeField] protected BuildingData _data;
        [SerializeField] protected Transform _rallyPoint;

        public BuildingData Data => _data;
        public Faction Faction => _data != null ? _data.Faction : Faction.Neutral;
        public float MaxHealth => _data != null ? _data.MaxHealth : 500f;
        public float CurrentHealth { get; protected set; }
        public bool IsDestroyed { get; private set; }
        public Transform Transform => transform;
        public Transform RallyPoint => _rallyPoint != null ? _rallyPoint : transform;

        protected virtual void Awake()
        {
            CurrentHealth = MaxHealth;
        }

        public virtual void TakeDamage(float amount)
        {
            if (IsDestroyed) return;
            CurrentHealth -= amount;
            if (CurrentHealth <= 0f) OnDestroyed();
        }

        protected virtual void OnDestroyed()
        {
            if (IsDestroyed) return;
            IsDestroyed = true;
            EventBus.Publish(new BuildingDestroyedEvent { Building = this, Faction = Faction });
            Destroy(gameObject, 1f);
        }

        public virtual void OnSelected() { }
        public virtual void OnDeselected() { }

        public void Initialize(BuildingData data)
        {
            _data = data;
            CurrentHealth = data.MaxHealth;
        }
    }
}
