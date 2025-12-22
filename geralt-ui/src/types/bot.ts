export interface Bot {
  id: string
  bot_token: string
  bot_name: string
  icon_url?: string
  welcome_message?: string
  welcome_buttons?: WelcomeButton[]
  collection_ids?: string[]
  created_at: string
  updated_at: string
  owner_id: string
  shared_with?: BotShare[]
}

export interface WelcomeButton {
  id: string
  label: string
  action: string
}

export interface BotShare {
  user_id: string
  role: 'viewer' | 'contributor' | 'admin'
}

export interface Collection {
  id: string
  collection_name: string
  description?: string
  file_count: number
  created_at: string
  tenant_id: string
}

export interface CreateBotCommand {
  bot_name: string
  icon_url?: string
  welcome_message?: string
  welcome_buttons?: Omit<WelcomeButton, 'id'>[]
  collection_ids?: string[]
}

export interface UpdateBotCommand extends Partial<CreateBotCommand> {
  bot_token: string
}

export interface ShareBotCommand {
  bot_token: string
  user_email: string
  role: BotShare['role']
}

export interface BotEmbedCode {
  bot_token: string
  embed_code: string
}
