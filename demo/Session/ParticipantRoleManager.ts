import { dom } from '../dom';
import sipConnectorFacade from './sipConnectorFacade';

/**
 * Тип роли участника
 */
export type TParticipantRole = 'participant' | 'spectatorSynthetic' | 'spectator' | undefined;

/**
 * Тип обработчика изменений роли участника
 */
type TParticipantRoleHandler = (role: TParticipantRole) => void;

/**
 * Класс для управления состоянием роли участника
 * Отслеживает текущую роль участника (участник/зритель) и подписывается на события
 */
class ParticipantRoleManager {
  private role: TParticipantRole = undefined;

  private readonly handlers: Set<TParticipantRoleHandler> = new Set<TParticipantRoleHandler>();

  private unsubscribeMoveToSpectators: (() => void) | undefined = undefined;

  private unsubscribeMoveToSpectatorsNew: (() => void) | undefined = undefined;

  private unsubscribeMoveToParticipants: (() => void) | undefined = undefined;

  /**
   * Возвращает текущую роль участника
   */
  public getRole(): TParticipantRole {
    return this.role;
  }

  /**
   * Подписывается на события изменения роли участника
   */
  public subscribe(): void {
    // Подписываемся на событие перемещения в участники
    this.unsubscribeMoveToParticipants = sipConnectorFacade.on(
      'api:participant:move-request-to-participants',
      () => {
        this.setRole('participant');
      },
    );

    // Подписываемся на событие перемещения в зрители
    this.unsubscribeMoveToSpectators = sipConnectorFacade.on(
      'api:participant:move-request-to-spectators-synthetic',
      () => {
        this.setRole('spectatorSynthetic');
      },
    );

    // Подписываемся на событие перемещения в зрители для новых серверов
    this.unsubscribeMoveToSpectatorsNew = sipConnectorFacade.on(
      'api:participant:move-request-to-spectators-with-audio-id',
      () => {
        this.setRole('spectator');
      },
    );

    this.onChange(this.handleParticipantRoleChange);
  }

  /**
   * Отписывается от событий изменения роли участника
   */
  public unsubscribe(): void {
    if (this.unsubscribeMoveToSpectators) {
      this.unsubscribeMoveToSpectators();
      this.unsubscribeMoveToSpectators = undefined;
    }

    if (this.unsubscribeMoveToSpectatorsNew) {
      this.unsubscribeMoveToSpectatorsNew();
      this.unsubscribeMoveToSpectatorsNew = undefined;
    }

    if (this.unsubscribeMoveToParticipants) {
      this.unsubscribeMoveToParticipants();
      this.unsubscribeMoveToParticipants = undefined;
    }
  }

  /**
   * Подписывается на изменения роли участника
   */
  public onChange(handler: TParticipantRoleHandler): () => void {
    this.handlers.add(handler);

    // Возвращаем функцию для отписки
    return () => {
      this.handlers.delete(handler);
    };
  }

  /**
   * Сбрасывает роль участника
   */
  public reset(): void {
    this.setRole(undefined);
  }

  /**
   * Устанавливает новую роль участника
   */
  private setRole(newRole: TParticipantRole): void {
    if (this.role !== newRole) {
      this.role = newRole;
      this.notifyHandlers();
    }
  }

  /**
   * Уведомляет всех подписчиков об изменении роли
   */
  private notifyHandlers(): void {
    this.handlers.forEach((handler) => {
      handler(this.role);
    });
  }

  /**
   * Обрабатывает изменения роли участника
   */
  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  private readonly handleParticipantRoleChange = (role: TParticipantRole): void => {
    if (role === undefined) {
      dom.participantRoleElement.textContent = '';

      return;
    }

    let roleText = '';

    switch (role) {
      case 'participant': {
        roleText = 'Участник';

        break;
      }

      case 'spectatorSynthetic': {
        roleText = 'Зритель (синтетический)';

        break;
      }

      case 'spectator': {
        roleText = 'Зритель (NEW)';

        break;
      }

      default: {
        roleText = '';
      }
    }

    dom.participantRoleElement.textContent = roleText;
  };
}

export default ParticipantRoleManager;
